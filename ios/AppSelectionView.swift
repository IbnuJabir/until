/**
 * AppSelectionView - SwiftUI wrapper for FamilyActivityPicker
 * Allows user to explicitly select which apps to monitor
 */

import SwiftUI
import FamilyControls
import ManagedSettings
import UIKit
import React

// MARK: - App Selection Coordinator

/**
 * Coordinator to handle communication between SwiftUI view and React Native module
 * Singleton pattern ensures callbacks reach the right place
 */
class AppSelectionCoordinator {
  static let shared = AppSelectionCoordinator()

  private var resolveCallback: RCTPromiseResolveBlock?
  private var rejectCallback: RCTPromiseRejectBlock?
  private var tokenStorageCallback: ((Set<ApplicationToken>) -> Void)?

  private init() {}

  func setCompletion(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    self.resolveCallback = resolve
    self.rejectCallback = reject
  }

  func setTokenStorage(callback: @escaping (Set<ApplicationToken>) -> Void) {
    self.tokenStorageCallback = callback
  }

  func complete(with tokens: Set<ApplicationToken>) {
    // Call the callback to store tokens
    tokenStorageCallback?(tokens)

    // Return success with token count (tokens themselves can't be serialized)
    resolveCallback?(["selectedCount": tokens.count])
    clearCallbacks()
  }

  func cancel() {
    rejectCallback?("USER_CANCELLED", "User cancelled app selection", nil)
    clearCallbacks()
  }

  private func clearCallbacks() {
    resolveCallback = nil
    rejectCallback = nil
    tokenStorageCallback = nil
  }
}

// MARK: - SwiftUI View

struct AppSelectionView: View {
  @State private var selection = FamilyActivitySelection()
  @Environment(\.presentationMode) var presentationMode

  var body: some View {
    NavigationView {
      VStack(spacing: 20) {
        Text("Select Apps to Monitor")
          .font(.headline)
          .padding(.top)

        Text("Choose which apps will trigger your reminder when opened")
          .font(.subheadline)
          .foregroundColor(.secondary)
          .multilineTextAlignment(.center)
          .padding(.horizontal)

        // Apple's official FamilyActivityPicker
        FamilyActivityPicker(selection: $selection)
          .padding()

        Spacer()
      }
      .navigationBarTitle("App Selection", displayMode: .inline)
      .navigationBarItems(
        leading: Button("Cancel") {
          AppSelectionCoordinator.shared.cancel()
          presentationMode.wrappedValue.dismiss()
        },
        trailing: Button("Done") {
          handleDone()
        }
        .disabled(selection.applicationTokens.isEmpty)
      )
    }
  }

  private func handleDone() {
    // Pass selected app tokens to coordinator
    // selection.applicationTokens returns Set<ApplicationToken>
    AppSelectionCoordinator.shared.complete(with: selection.applicationTokens)
    presentationMode.wrappedValue.dismiss()
  }
}

// MARK: - UIKit View Controller Wrapper

class AppSelectionViewController: UIViewController {
  override func viewDidLoad() {
    super.viewDidLoad()

    // Embed SwiftUI view in UIViewController
    let swiftUIView = AppSelectionView()
    let hostingController = UIHostingController(rootView: swiftUIView)

    addChild(hostingController)
    hostingController.view.frame = view.bounds
    hostingController.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.addSubview(hostingController.view)
    hostingController.didMove(toParent: self)
  }
}
