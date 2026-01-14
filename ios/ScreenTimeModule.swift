/**
 * ScreenTimeModule - App Open Detection
 * Follows CONTEXT.md Phase 3 - Section 7.5
 *
 * ONLY APPROVED METHOD:
 * - Screen Time APIs (FamilyControls, DeviceActivity, ManagedSettings)
 * - Requires iOS 15+
 * - User must explicitly select apps
 *
 * IMPORTANT:
 * - DO NOT infer apps silently
 * - DO NOT log usage
 * - DO NOT store usage history
 *
 * NOTE: This implementation requires:
 * 1. FamilyControls framework entitlements
 * 2. App Store review approval
 * 3. DeviceActivityMonitor extension
 */

import Foundation
import React
import FamilyControls
import ManagedSettings

@objc(ScreenTimeModule)
class ScreenTimeModule: RCTEventEmitter {

  private var hasListeners = false
  private let authorizationCenter = AuthorizationCenter.shared

  // Store selected app tokens (used for monitoring)
  private var selectedAppTokens: Set<ApplicationToken> = []

  override init() {
    super.init()
    setupAuthorizationObserver()
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  // MARK: - Authorization Observer

  private func setupAuthorizationObserver() {
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(authorizationDidChange),
      name: Notification.Name("FamilyControlsAuthorizationDidChange"),
      object: nil
    )
  }

  @objc private func authorizationDidChange() {
    if hasListeners {
      let status = getAuthorizationStatusString()
      sendEvent(
        withName: "SCREEN_TIME_PERMISSION_CHANGED",
        body: ["status": status]
      )
    }
  }

  private func getAuthorizationStatusString() -> String {
    switch authorizationCenter.authorizationStatus {
    case .notDetermined:
      return "not_determined"
    case .denied:
      return "denied"
    case .approved:
      return "approved"
    @unknown default:
      return "unknown"
    }
  }

  // MARK: - RCTEventEmitter Configuration

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  override func supportedEvents() -> [String]! {
    return ["APP_OPENED", "SCREEN_TIME_PERMISSION_CHANGED"]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  // MARK: - Exposed Methods

  @objc
  func requestScreenTimePermission(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if #available(iOS 16.0, *) {
      Task {
        do {
          try await authorizationCenter.requestAuthorization(for: .individual)
          let status = getAuthorizationStatusString()
          resolve(status)
        } catch {
          reject("PERMISSION_ERROR", "Failed to request authorization: \(error.localizedDescription)", error)
        }
      }
    } else {
      reject("UNSUPPORTED_IOS_VERSION", "Screen Time API requires iOS 16.0 or later", nil)
    }
  }

  @objc
  func getScreenTimePermissionStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let status = getAuthorizationStatusString()
    resolve(status)
  }

  @objc
  func presentAppPicker(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    // Check authorization first
    guard authorizationCenter.authorizationStatus == .approved else {
      reject("NOT_AUTHORIZED", "Family Controls authorization not granted", nil)
      return
    }

    // Store resolve/reject for callback from the SwiftUI view
    AppSelectionCoordinator.shared.setCompletion(resolve: resolve, reject: reject)

    // Set up token storage callback
    AppSelectionCoordinator.shared.setTokenStorage { [weak self] tokens in
      self?.storeSelectedApps(tokens)
    }

    // Present the app picker on main thread
    DispatchQueue.main.async {
      guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
            let rootViewController = windowScene.windows.first?.rootViewController else {
        reject("NO_WINDOW", "Could not find root view controller", nil)
        return
      }

      let appSelectionView = AppSelectionViewController()
      appSelectionView.modalPresentationStyle = .formSheet
      rootViewController.present(appSelectionView, animated: true)
    }
  }

  @objc
  func hasSelectedApps(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(!selectedAppTokens.isEmpty)
  }

  // Internal method to store selected app tokens
  func storeSelectedApps(_ tokens: Set<ApplicationToken>) {
    selectedAppTokens = tokens
    print("[ScreenTimeModule] Stored \(tokens.count) app tokens")
  }

  @objc
  func clearSelectedApps(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    selectedAppTokens.removeAll()
    resolve(true)
  }

  // MARK: - Internal Event Emitter (for DeviceActivityMonitor extension)

  func emitAppOpenedEvent(appToken: String) {
    if hasListeners {
      sendEvent(
        withName: "APP_OPENED",
        body: [
          "timestamp": Date().timeIntervalSince1970 * 1000,
          "type": "APP_OPENED",
          "data": [
            "appToken": appToken
          ]
        ]
      )
    }
  }
}
