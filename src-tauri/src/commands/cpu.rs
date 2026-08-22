use std::sync::Mutex;

use sysinfo::{CpuRefreshKind, RefreshKind, System};
use tauri::State;

pub struct CpuSampler {
    inner: Mutex<CpuSamplerInner>,
}

struct CpuSamplerInner {
    system: System,
    has_baseline: bool,
}

impl Default for CpuSampler {
    fn default() -> Self {
        Self {
            inner: Mutex::new(CpuSamplerInner {
                system: System::new(),
                has_baseline: false,
            }),
        }
    }
}

impl CpuSampler {
    fn sample(&self, reset: bool) -> Result<Option<f32>, String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "CPU sampler lock is unavailable.".to_string())?;

        if reset || !inner.has_baseline {
            inner.system = System::new_with_specifics(
                RefreshKind::nothing().with_cpu(CpuRefreshKind::nothing().with_cpu_usage()),
            );
            inner.has_baseline = true;
            return Ok(None);
        }

        inner.system.refresh_cpu_usage();
        let usage = inner.system.global_cpu_usage();

        if !usage.is_finite() {
            return Err("CPU sampler returned a non-finite value.".to_string());
        }

        let usage = usage.clamp(0.0, 100.0);
        Ok(Some(usage))
    }
}

#[tauri::command]
pub fn sample_cpu_usage(
    sampler: State<'_, CpuSampler>,
    reset: bool,
) -> Result<Option<f32>, String> {
    sampler.sample(reset)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;

    #[test]
    fn requires_a_baseline_before_returning_cpu_usage() {
        let sampler = CpuSampler::default();
        assert_eq!(sampler.sample(true).unwrap(), None);

        thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
        let usage = sampler.sample(false).unwrap().unwrap();

        assert!((0.0..=100.0).contains(&usage));
    }
}
