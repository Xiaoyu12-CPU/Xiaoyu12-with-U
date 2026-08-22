use serde::Serialize;
use starship_battery::{units::ratio::percent, Manager, State as LibraryBatteryState};
use tauri::State;

pub struct BatterySampler {
    manager: Option<Manager>,
    initialization_error: Option<String>,
}

impl Default for BatterySampler {
    fn default() -> Self {
        match Manager::new() {
            Ok(manager) => Self {
                manager: Some(manager),
                initialization_error: None,
            },
            Err(error) => Self {
                manager: None,
                initialization_error: Some(error.to_string()),
            },
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum BatteryState {
    Charging,
    Discharging,
    Full,
    Unknown,
    Unavailable,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatterySnapshot {
    battery_percent: Option<f32>,
    battery_state: BatteryState,
    battery_present: bool,
}

impl BatterySampler {
    fn sample(&self) -> Result<BatterySnapshot, String> {
        let manager = self.manager.as_ref().ok_or_else(|| {
            format!(
                "Battery manager is unavailable: {}",
                self.initialization_error
                    .as_deref()
                    .unwrap_or("unknown initialization error")
            )
        })?;
        let batteries = manager
            .batteries()
            .map_err(|error| format!("Failed to enumerate batteries: {error}"))?;
        let mut first_read_error: Option<String> = None;

        for battery_result in batteries {
            match battery_result {
                Ok(battery) => {
                    let battery_percent = battery.state_of_charge().get::<percent>();
                    if !battery_percent.is_finite() {
                        return Err("Battery returned an invalid state of charge.".to_string());
                    }

                    return Ok(BatterySnapshot {
                        battery_percent: Some(battery_percent.clamp(0.0, 100.0)),
                        battery_state: map_battery_state(battery.state()),
                        battery_present: true,
                    });
                }
                Err(error) => {
                    if first_read_error.is_none() {
                        first_read_error = Some(error.to_string());
                    }
                }
            }
        }

        if let Some(error) = first_read_error {
            return Err(format!("Failed to read a system battery: {error}"));
        }

        Ok(BatterySnapshot {
            battery_percent: None,
            battery_state: BatteryState::Unavailable,
            battery_present: false,
        })
    }
}

fn map_battery_state(state: LibraryBatteryState) -> BatteryState {
    match state {
        LibraryBatteryState::Charging => BatteryState::Charging,
        LibraryBatteryState::Discharging | LibraryBatteryState::Empty => BatteryState::Discharging,
        LibraryBatteryState::Full => BatteryState::Full,
        LibraryBatteryState::Unknown => BatteryState::Unknown,
    }
}

#[tauri::command]
pub fn sample_battery_status(
    sampler: State<'_, BatterySampler>,
) -> Result<BatterySnapshot, String> {
    sampler.sample()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_library_battery_states() {
        assert_eq!(
            map_battery_state(LibraryBatteryState::Charging),
            BatteryState::Charging
        );
        assert_eq!(
            map_battery_state(LibraryBatteryState::Discharging),
            BatteryState::Discharging
        );
        assert_eq!(
            map_battery_state(LibraryBatteryState::Empty),
            BatteryState::Discharging
        );
        assert_eq!(
            map_battery_state(LibraryBatteryState::Full),
            BatteryState::Full
        );
        assert_eq!(
            map_battery_state(LibraryBatteryState::Unknown),
            BatteryState::Unknown
        );
    }

    #[test]
    fn samples_battery_or_reports_no_battery() {
        let snapshot = BatterySampler::default().sample().unwrap();

        if snapshot.battery_present {
            assert!(snapshot.battery_percent.is_some());
            assert!((0.0..=100.0).contains(&snapshot.battery_percent.unwrap()));
            assert_ne!(snapshot.battery_state, BatteryState::Unavailable);
        } else {
            assert!(snapshot.battery_percent.is_none());
            assert_eq!(snapshot.battery_state, BatteryState::Unavailable);
        }
    }
}
