import Foundation
import React
import CoreLocation

@objc(LocationModule)
class LocationModule: RCTEventEmitter, CLLocationManagerDelegate {

  private var hasListeners = false
  private let locationManager = CLLocationManager()
  private var pendingResolve: RCTPromiseResolveBlock?
  private var pendingReject: RCTPromiseRejectBlock?
  private var locationResolve: RCTPromiseResolveBlock?
  private var locationReject: RCTPromiseRejectBlock?

  override init() {
    super.init()
    locationManager.delegate = self
    locationManager.desiredAccuracy = kCLLocationAccuracyBest
    locationManager.allowsBackgroundLocationUpdates = false
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  override func supportedEvents() -> [String]! {
    return ["LOCATION_REGION_ENTERED"]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  // MARK: - Permission Methods

  @objc
  func requestLocationPermission(_ resolve: @escaping RCTPromiseResolveBlock,
                                  rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }

      let status = self.locationManager.authorizationStatus

      switch status {
      case .notDetermined:
        self.pendingResolve = resolve
        self.pendingReject = reject
        self.locationManager.requestAlwaysAuthorization()
      case .authorizedWhenInUse:
        self.pendingResolve = resolve
        self.pendingReject = reject
        self.locationManager.requestAlwaysAuthorization()
      case .authorizedAlways:
        resolve("authorized_always")
      case .denied:
        resolve("denied")
      case .restricted:
        resolve("restricted")
      @unknown default:
        resolve("not_determined")
      }
    }
  }

  @objc
  func getLocationPermissionStatus(_ resolve: @escaping RCTPromiseResolveBlock,
                                    rejecter reject: @escaping RCTPromiseRejectBlock) {
    let status = locationManager.authorizationStatus
    resolve(statusToString(status))
  }

  // MARK: - Geofence Methods

  @objc
  func registerGeofence(_ identifier: String,
                         latitude: Double,
                         longitude: Double,
                         radius: Double,
                         resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) else {
      reject("MONITORING_UNAVAILABLE", "Region monitoring is not available on this device", nil)
      return
    }

    let coordinate = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    let clampedRadius = min(radius, locationManager.maximumRegionMonitoringDistance)
    let region = CLCircularRegion(center: coordinate, radius: clampedRadius, identifier: identifier)
    region.notifyOnEntry = true
    region.notifyOnExit = false

    locationManager.startMonitoring(for: region)

    resolve([
      "identifier": identifier,
      "latitude": latitude,
      "longitude": longitude,
      "radius": clampedRadius
    ] as [String: Any])
  }

  @objc
  func unregisterGeofence(_ identifier: String,
                           resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
    for region in locationManager.monitoredRegions {
      if region.identifier == identifier {
        locationManager.stopMonitoring(for: region)
        resolve(true)
        return
      }
    }
    resolve(false)
  }

  @objc
  func getMonitoredRegions(_ resolve: @escaping RCTPromiseResolveBlock,
                            rejecter reject: @escaping RCTPromiseRejectBlock) {
    let regions = locationManager.monitoredRegions.compactMap { region -> [String: Any]? in
      guard let circular = region as? CLCircularRegion else { return nil }
      return [
        "identifier": circular.identifier,
        "latitude": circular.center.latitude,
        "longitude": circular.center.longitude,
        "radius": circular.radius
      ]
    }

    resolve([
      "count": regions.count,
      "maxLimit": 20,
      "regions": regions
    ] as [String: Any])
  }

  @objc
  func getCurrentLocation(_ resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard CLLocationManager.locationServicesEnabled() else {
      reject("LOCATION_DISABLED", "Location services are disabled", nil)
      return
    }

    self.locationResolve = resolve
    self.locationReject = reject
    locationManager.requestLocation()
  }

  // MARK: - CLLocationManagerDelegate

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    let status = manager.authorizationStatus

    if let resolve = pendingResolve {
      resolve(statusToString(status))
      pendingResolve = nil
      pendingReject = nil
    }
  }

  func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
    guard hasListeners, let circular = region as? CLCircularRegion else { return }

    let timestamp = Date().timeIntervalSince1970 * 1000
    sendEvent(withName: "LOCATION_REGION_ENTERED", body: [
      "timestamp": timestamp,
      "type": "LOCATION_REGION_ENTERED",
      "data": [
        "identifier": circular.identifier,
        "latitude": circular.center.latitude,
        "longitude": circular.center.longitude,
        "radius": circular.radius
      ]
    ] as [String: Any])
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last, let resolve = locationResolve else { return }

    resolve([
      "latitude": location.coordinate.latitude,
      "longitude": location.coordinate.longitude,
      "accuracy": location.horizontalAccuracy,
      "timestamp": location.timestamp.timeIntervalSince1970 * 1000
    ] as [String: Any])

    locationResolve = nil
    locationReject = nil
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    if let reject = locationReject {
      reject("LOCATION_ERROR", error.localizedDescription, error)
      locationResolve = nil
      locationReject = nil
    }
  }

  func locationManager(_ manager: CLLocationManager, monitoringDidFailFor region: CLRegion?, withError error: Error) {
    print("[LocationModule] Monitoring failed for region: \(region?.identifier ?? "unknown"), error: \(error.localizedDescription)")
  }

  // MARK: - Helpers

  private func statusToString(_ status: CLAuthorizationStatus) -> String {
    switch status {
    case .notDetermined: return "not_determined"
    case .restricted: return "restricted"
    case .denied: return "denied"
    case .authorizedAlways: return "authorized_always"
    case .authorizedWhenInUse: return "authorized_when_in_use"
    @unknown default: return "not_determined"
    }
  }
}
