use std::{
    sync::Mutex,
    time::{Duration, Instant},
};

use serde::Serialize;
use sysinfo::Networks;
use tauri::State;

pub struct NetworkSampler {
    inner: Mutex<NetworkSamplerInner>,
}

struct NetworkSamplerInner {
    networks: Networks,
    baseline: Option<NetworkBaseline>,
}

#[derive(Clone, Copy, Debug)]
struct NetworkBaseline {
    received_bytes: u64,
    transmitted_bytes: u64,
    sampled_at: Instant,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkRateSnapshot {
    download_bytes_per_second: f64,
    upload_bytes_per_second: f64,
}

impl Default for NetworkSampler {
    fn default() -> Self {
        Self {
            inner: Mutex::new(NetworkSamplerInner {
                networks: Networks::new(),
                baseline: None,
            }),
        }
    }
}

impl NetworkSampler {
    fn sample(
        &self,
        reset: bool,
        expected_interval_ms: u64,
    ) -> Result<Option<NetworkRateSnapshot>, String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "Network sampler lock is unavailable.".to_string())?;

        if reset || inner.baseline.is_none() {
            inner.networks = Networks::new_with_refreshed_list();
        } else {
            inner.networks.refresh(true);
        }

        let current = NetworkBaseline {
            received_bytes: total_received_bytes(&inner.networks),
            transmitted_bytes: total_transmitted_bytes(&inner.networks),
            sampled_at: Instant::now(),
        };
        let previous = inner.baseline.replace(current);

        if reset {
            return Ok(None);
        }

        let Some(previous) = previous else {
            return Ok(None);
        };

        Ok(calculate_rates(previous, current, expected_interval_ms))
    }
}

fn calculate_rates(
    previous: NetworkBaseline,
    current: NetworkBaseline,
    expected_interval_ms: u64,
) -> Option<NetworkRateSnapshot> {
    let elapsed = current
        .sampled_at
        .checked_duration_since(previous.sampled_at)?;
    let maximum_elapsed =
        Duration::from_millis(expected_interval_ms.saturating_mul(3)).max(Duration::from_secs(30));

    if elapsed.is_zero()
        || elapsed > maximum_elapsed
        || current.received_bytes < previous.received_bytes
        || current.transmitted_bytes < previous.transmitted_bytes
    {
        return None;
    }

    let elapsed_seconds = elapsed.as_secs_f64();
    let download_bytes_per_second =
        (current.received_bytes - previous.received_bytes) as f64 / elapsed_seconds;
    let upload_bytes_per_second =
        (current.transmitted_bytes - previous.transmitted_bytes) as f64 / elapsed_seconds;

    if !download_bytes_per_second.is_finite() || !upload_bytes_per_second.is_finite() {
        return None;
    }

    Some(NetworkRateSnapshot {
        download_bytes_per_second: download_bytes_per_second.max(0.0),
        upload_bytes_per_second: upload_bytes_per_second.max(0.0),
    })
}

fn total_received_bytes(networks: &Networks) -> u64 {
    networks
        .iter()
        .filter(|(name, data)| !is_loopback_interface(name, data))
        .map(|(_, data)| data.total_received())
        .sum()
}

fn total_transmitted_bytes(networks: &Networks) -> u64 {
    networks
        .iter()
        .filter(|(name, data)| !is_loopback_interface(name, data))
        .map(|(_, data)| data.total_transmitted())
        .sum()
}

fn is_loopback_interface(name: &str, data: &sysinfo::NetworkData) -> bool {
    let normalized_name = name.to_ascii_lowercase();
    let name_is_loopback = normalized_name == "lo"
        || normalized_name
            .strip_prefix("lo")
            .is_some_and(|suffix| !suffix.is_empty() && suffix.chars().all(|c| c.is_ascii_digit()))
        || normalized_name.contains("loopback");
    let addresses = data.ip_networks();
    let addresses_are_loopback =
        !addresses.is_empty() && addresses.iter().all(|network| network.addr.is_loopback());

    name_is_loopback || addresses_are_loopback
}

#[tauri::command]
pub fn sample_network_throughput(
    sampler: State<'_, NetworkSampler>,
    reset: bool,
    expected_interval_ms: u64,
) -> Result<Option<NetworkRateSnapshot>, String> {
    if !(500..=10_000).contains(&expected_interval_ms) {
        return Err("Network poll interval must be between 500 and 10000 ms.".to_string());
    }

    sampler.sample(reset, expected_interval_ms)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn baseline(received: u64, transmitted: u64, sampled_at: Instant) -> NetworkBaseline {
        NetworkBaseline {
            received_bytes: received,
            transmitted_bytes: transmitted,
            sampled_at,
        }
    }

    #[test]
    fn calculates_rates_from_real_elapsed_time() {
        let started_at = Instant::now();
        let rates = calculate_rates(
            baseline(1_000, 2_000, started_at),
            baseline(5_000, 3_000, started_at + Duration::from_secs(2)),
            5_000,
        )
        .unwrap();

        assert_eq!(rates.download_bytes_per_second, 2_000.0);
        assert_eq!(rates.upload_bytes_per_second, 500.0);
    }

    #[test]
    fn discards_an_interval_that_looks_like_sleep_or_wake() {
        let started_at = Instant::now();
        let rates = calculate_rates(
            baseline(1_000, 2_000, started_at),
            baseline(5_000, 3_000, started_at + Duration::from_secs(31)),
            5_000,
        );

        assert!(rates.is_none());
    }

    #[test]
    fn discards_counter_resets() {
        let started_at = Instant::now();
        let rates = calculate_rates(
            baseline(5_000, 3_000, started_at),
            baseline(1_000, 2_000, started_at + Duration::from_secs(5)),
            5_000,
        );

        assert!(rates.is_none());
    }
}
