use std::sync::Mutex;

use serde::Serialize;
use sysinfo::{MemoryRefreshKind, System};
use tauri::State;

pub struct MemorySampler {
    system: Mutex<System>,
}

impl Default for MemorySampler {
    fn default() -> Self {
        Self {
            system: Mutex::new(System::new()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemorySnapshot {
    total_memory: u64,
    used_memory: u64,
    available_memory: u64,
    usage_percent: f32,
}

impl MemorySampler {
    fn sample(&self) -> Result<MemorySnapshot, String> {
        let mut system = self
            .system
            .lock()
            .map_err(|_| "Memory sampler lock is unavailable.".to_string())?;

        system.refresh_memory_specifics(MemoryRefreshKind::nothing().with_ram());

        let total_memory = system.total_memory();
        let used_memory = system.used_memory();
        let available_memory = system.available_memory();

        if total_memory == 0 {
            return Err("Memory sampler returned zero total memory.".to_string());
        }

        let usage_percent =
            ((used_memory as f64 / total_memory as f64) * 100.0).clamp(0.0, 100.0) as f32;

        Ok(MemorySnapshot {
            total_memory,
            used_memory,
            available_memory,
            usage_percent,
        })
    }
}

#[tauri::command]
pub fn sample_memory_usage(sampler: State<'_, MemorySampler>) -> Result<MemorySnapshot, String> {
    sampler.sample()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn samples_real_system_memory() {
        let snapshot = MemorySampler::default().sample().unwrap();

        assert!(snapshot.total_memory > 0);
        assert!(snapshot.used_memory <= snapshot.total_memory);
        assert!(snapshot.available_memory <= snapshot.total_memory);
        assert!((0.0..=100.0).contains(&snapshot.usage_percent));
    }
}
