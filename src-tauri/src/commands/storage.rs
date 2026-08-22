use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};

use serde::Serialize;
use sysinfo::{Disk, Disks};
use tauri::State;

pub struct StorageSampler {
    disks: Mutex<Disks>,
}

impl Default for StorageSampler {
    fn default() -> Self {
        Self {
            disks: Mutex::new(Disks::new()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageSnapshot {
    total_bytes: u64,
    used_bytes: u64,
    available_bytes: u64,
    usage_percent: f64,
}

impl StorageSampler {
    fn sample(&self) -> Result<StorageSnapshot, String> {
        let mut disks = self
            .disks
            .lock()
            .map_err(|_| "Storage sampler lock is unavailable.".to_string())?;

        disks.refresh(true);

        let system_mount_point = system_mount_point();
        let disk = select_system_disk(&disks, &system_mount_point).ok_or_else(|| {
            format!(
                "Storage sampler could not find the system volume at {}.",
                system_mount_point.display()
            )
        })?;

        let total_bytes = disk.total_space();
        if total_bytes == 0 {
            return Err("Storage sampler returned zero total space.".to_string());
        }

        let available_bytes = disk.available_space().min(total_bytes);
        let used_bytes = total_bytes.saturating_sub(available_bytes);
        let usage_percent = ((used_bytes as f64 / total_bytes as f64) * 100.0).clamp(0.0, 100.0);

        Ok(StorageSnapshot {
            total_bytes,
            used_bytes,
            available_bytes,
            usage_percent,
        })
    }
}

fn select_system_disk<'a>(disks: &'a Disks, mount_point: &Path) -> Option<&'a Disk> {
    disks
        .list()
        .iter()
        .filter(|disk| disk.mount_point() == mount_point)
        .max_by_key(|disk| (disk.total_space(), disk.available_space()))
}

#[cfg(target_os = "windows")]
fn system_mount_point() -> PathBuf {
    let mut root = PathBuf::from(
        std::env::var_os("SystemDrive").unwrap_or_else(|| std::ffi::OsString::from("C:")),
    );
    root.push("\\");
    root
}

#[cfg(not(target_os = "windows"))]
fn system_mount_point() -> PathBuf {
    PathBuf::from("/")
}

#[tauri::command]
pub fn sample_storage_usage(sampler: State<'_, StorageSampler>) -> Result<StorageSnapshot, String> {
    sampler.sample()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn samples_real_system_storage() {
        let snapshot = StorageSampler::default().sample().unwrap();

        assert!(snapshot.total_bytes > 0);
        assert!(snapshot.used_bytes <= snapshot.total_bytes);
        assert!(snapshot.available_bytes <= snapshot.total_bytes);
        assert_eq!(
            snapshot.used_bytes,
            snapshot.total_bytes - snapshot.available_bytes
        );
        assert!((0.0..=100.0).contains(&snapshot.usage_percent));
    }
}
