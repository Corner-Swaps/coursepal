import Foundation
import StoreKit
import SwiftUI
#if os(iOS)
import UIKit
#endif

/// A production-ready in-app review manager in Swift using StoreKit that strictly complies
/// with Apple App Store Review Guideline 5.6.1.
///
/// Features:
/// 1. Launch Tracking (`UserDefaults`):
///    - Tracks total lifetime app launches from the original download (100% on-device, zero API or network tracking).
///    - Detects and preserves original install date (using the app's Document container creation date
///      for existing users updating, or current date on first launch).
///    - Tracks version-specific launches and update timestamp whenever a new app version is detected.
/// 2. Strict Milestone Triggers:
///    - The user MUST open/launch the app at least 15 times before the review pop-up can appear under any circumstances.
///    - Time elapsed alone (e.g. days since install or update) will never trigger the review dialog if the user
///      has not launched the app at least 15 times.
/// 3. Session Timing:
///    - Once criteria are satisfied on launch or foregrounding, waits exactly 11 seconds before presenting
///      the StoreKit review dialog, allowing the user to settle comfortably into their session without interrupting workflow.
/// 4. Submission Lock vs. Dismissal Re-Prompting:
///    - Only permanently disables review prompts if the user has actually submitted a review (`AppReview_HasSubmittedReview = true`).
///    - If dismissed ("Not Now") or not submitted, does not permanently lock the user out.
///    - Re-prompts again only after at least 15 MORE app launches have occurred AND at least 15 days have elapsed since the last prompt.
/// 5. StoreKit Presentation:
///    - Uses `AppStore.requestReview(in: windowScene)` on iOS 16+ (falling back to `SKStoreReviewController` on earlier versions)
///      targeting the active foreground `UIWindowScene`.
///    - Exposes `markReviewSubmitted()` to permanently lock prompts whenever an in-app review action is completed.
///    - Integrates cleanly with SwiftUI via `.trackAppReviewLifecycle()`, `.onAppear`, and `scenePhase` / `UIApplication.willEnterForegroundNotification`.
@MainActor
public final class AppReviewManager: ObservableObject {
    public static let shared = AppReviewManager()

    // MARK: - Threshold Configuration
    /// The user MUST open/launch the app at least this many times before the review pop-up can ever appear.
    public static let minimumLifetimeUsesRequired: Int = 15
    /// If dismissed without submitting, require at least this many additional app opens before re-prompting.
    public static let minimumUsesBetweenPrompts: Int = 15
    /// If dismissed without submitting, require at least this many days before re-prompting.
    public static let minimumDaysBetweenPrompts: Int = 15

    // MARK: - UserDefaults Keys
    public enum Keys {
        public static let hasSubmittedReview = "AppReview_HasSubmittedReview"
        public static let originalInstallDate = "AppReview_OriginalInstallDate"
        public static let lifetimeLaunchCount = "AppReview_LifetimeLaunchCount"
        public static let currentVersion = "AppReview_CurrentVersion"
        public static let currentVersionInstallDate = "AppReview_CurrentVersionInstallDate"
        public static let versionLaunchCount = "AppReview_VersionLaunchCount"
        public static let lastPromptDate = "AppReview_LastPromptDate"
        public static let lastPromptLaunchCount = "AppReview_LastPromptLaunchCount"
    }

    // MARK: - Published State
    @Published public private(set) var hasSubmittedReview: Bool
    @Published public private(set) var lifetimeLaunchCount: Int
    @Published public private(set) var versionLaunchCount: Int
    @Published public private(set) var originalInstallDate: Date
    @Published public private(set) var currentVersionInstallDate: Date
    @Published public private(set) var lastPromptDate: Date?
    @Published public private(set) var lastPromptLaunchCount: Int
    @Published public private(set) var isPromptScheduled: Bool = false

    // MARK: - Internal Session Management
    private var scheduledPromptTask: Task<Void, Never>?
    private var hasTrackedLaunchThisSession: Bool = false

    // MARK: - Initialization
    private init() {
        let defaults = UserDefaults.standard

        // 1. Triple-check permanent submission lock across memory, UserDefaults, and persistent disk marker
        let submitted = Self.isReviewSubmittedPersistently()
        if submitted {
            defaults.set(true, forKey: Keys.hasSubmittedReview)
            Self.writePersistentMarker()
        }

        // 2. Original install date (detect from document container if first time)
        let resolvedInstallDate: Date
        if let storedDate = defaults.object(forKey: Keys.originalInstallDate) as? Date {
            resolvedInstallDate = storedDate
        } else {
            let detectedDate = Self.detectOriginalInstallDate()
            defaults.set(detectedDate, forKey: Keys.originalInstallDate)
            resolvedInstallDate = detectedDate
        }

        // 3. Lifetime launch count
        let lifetime = defaults.integer(forKey: Keys.lifetimeLaunchCount)

        // 4. Version and version install date
        let currentBundleVersion = Self.bundleVersionString()
        let storedVersion = defaults.string(forKey: Keys.currentVersion)

        let resolvedVersionInstallDate: Date
        var resolvedVersionLaunches: Int

        if storedVersion == nil {
            // First time tracking with this manager
            defaults.set(currentBundleVersion, forKey: Keys.currentVersion)
            if let storedDate = defaults.object(forKey: Keys.currentVersionInstallDate) as? Date {
                resolvedVersionInstallDate = storedDate
            } else {
                defaults.set(resolvedInstallDate, forKey: Keys.currentVersionInstallDate)
                resolvedVersionInstallDate = resolvedInstallDate
            }
            resolvedVersionLaunches = defaults.integer(forKey: Keys.versionLaunchCount)
        } else if storedVersion != currentBundleVersion {
            // New version update detected on startup!
            defaults.set(currentBundleVersion, forKey: Keys.currentVersion)
            let updateDate = Date()
            defaults.set(updateDate, forKey: Keys.currentVersionInstallDate)
            resolvedVersionInstallDate = updateDate
            defaults.set(0, forKey: Keys.versionLaunchCount)
            resolvedVersionLaunches = 0
            print("🚀 [AppReviewManager] New app version detected: \(currentBundleVersion). Initialized version launch tracking.")
        } else {
            // Same version
            if let storedDate = defaults.object(forKey: Keys.currentVersionInstallDate) as? Date {
                resolvedVersionInstallDate = storedDate
            } else {
                defaults.set(resolvedInstallDate, forKey: Keys.currentVersionInstallDate)
                resolvedVersionInstallDate = resolvedInstallDate
            }
            resolvedVersionLaunches = defaults.integer(forKey: Keys.versionLaunchCount)
        }

        // 5. Last prompt info
        let lastPrompt = defaults.object(forKey: Keys.lastPromptDate) as? Date
        let lastLaunchCount = defaults.integer(forKey: Keys.lastPromptLaunchCount)

        // Assign all stored properties
        self.hasSubmittedReview = submitted
        self.originalInstallDate = resolvedInstallDate
        self.lifetimeLaunchCount = lifetime
        self.currentVersionInstallDate = resolvedVersionInstallDate
        self.versionLaunchCount = resolvedVersionLaunches
        self.lastPromptDate = lastPrompt
        self.lastPromptLaunchCount = lastLaunchCount
    }

    // MARK: - Helper Date / Version Detection
    private static func detectOriginalInstallDate() -> Date {
        if let docURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
           let attrs = try? FileManager.default.attributesOfItem(atPath: docURL.path),
           let creationDate = attrs[.creationDate] as? Date {
            print("📅 [AppReviewManager] Detected original install date from Document container: \(creationDate)")
            return creationDate
        }
        return Date()
    }

    // MARK: - Persistent Lockout Disk Marker
    private static var reviewSubmittedMarkerURL: URL? {
        guard let docDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            return nil
        }
        return docDir.appendingPathComponent(".coursepal_review_submitted")
    }

    /// Triple-checks whether a review has been submitted across memory, UserDefaults, and persistent disk marker.
    public static func isReviewSubmittedPersistently() -> Bool {
        if UserDefaults.standard.bool(forKey: Keys.hasSubmittedReview) {
            return true
        }
        guard let url = reviewSubmittedMarkerURL else { return false }
        return FileManager.default.fileExists(atPath: url.path)
    }

    private static func writePersistentMarker() {
        guard let url = reviewSubmittedMarkerURL else { return }
        let markerContent = "ReviewSubmitted:\(Date().timeIntervalSince1970)\n"
        try? markerContent.write(to: url, atomically: true, encoding: .utf8)
    }

    private static func removePersistentMarker() {
        guard let url = reviewSubmittedMarkerURL else { return }
        try? FileManager.default.removeItem(at: url)
    }

    private static func bundleVersionString() -> String {
        let shortVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let buildNumber = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(shortVersion) (\(buildNumber))"
    }

    // MARK: - Computed Properties for Criteria
    public var daysSinceOriginalInstall: Int {
        Calendar.current.dateComponents([.day], from: originalInstallDate, to: Date()).day ?? 0
    }

    public var daysSinceCurrentVersionUpdate: Int {
        Calendar.current.dateComponents([.day], from: currentVersionInstallDate, to: Date()).day ?? 0
    }

    public var daysSinceLastPrompt: Int? {
        guard let lastPrompt = lastPromptDate else { return nil }
        return Calendar.current.dateComponents([.day], from: lastPrompt, to: Date()).day ?? 0
    }

    public var launchesSinceLastPrompt: Int {
        max(0, lifetimeLaunchCount - lastPromptLaunchCount)
    }

    /// Determines whether the user is an existing user updating from a prior installation
    public var isExistingUser: Bool {
        // If the current version install date is later than original install date by at least 1 day,
        // or lifetime launch count exceeds launches on this version, user is an existing user.
        if currentVersionInstallDate.timeIntervalSince(originalInstallDate) > 86400 {
            return true
        }
        if lifetimeLaunchCount > versionLaunchCount {
            return true
        }
        return false
    }

    /// Evaluates all Apple Guideline 5.6.1 and milestone criteria to determine if a review prompt should be triggered.
    /// Strictly requires the user to have used the app at least 15 times before the pop-up can appear.
    public var shouldRequestReview: Bool {
        // 1. Permanent lockout: Triple-checked across in-memory state, UserDefaults, and persistent disk marker
        guard !hasSubmittedReview &&
              !UserDefaults.standard.bool(forKey: Keys.hasSubmittedReview) &&
              !Self.isReviewSubmittedPersistently() else {
            return false
        }

        // 2. Strict usage requirement: The user MUST use the app at least 15 times before the review prompt can ever appear.
        guard lifetimeLaunchCount >= Self.minimumLifetimeUsesRequired else {
            return false
        }

        // 3. Dismissal Re-Prompting Rule:
        // If previously prompted, only re-prompt if at least 15 MORE app uses have occurred
        // AND at least 15 days have elapsed since the last prompt.
        if let daysSincePrompt = daysSinceLastPrompt {
            let launchesSincePrompt = launchesSinceLastPrompt
            guard launchesSincePrompt >= Self.minimumUsesBetweenPrompts else {
                return false
            }
            guard daysSincePrompt >= Self.minimumDaysBetweenPrompts else {
                return false
            }
        }

        return true
    }

    // MARK: - Public Launch & Lifecycle Actions

    /// Tracks an application launch, updates launch counters, detects version changes,
    /// and checks if the review prompt criteria are satisfied.
    public func trackAppLaunchAndCheck() {
        guard !hasTrackedLaunchThisSession else {
            checkAndRequestReviewIfAppropriate()
            return
        }
        hasTrackedLaunchThisSession = true

        let defaults = UserDefaults.standard
        let currentBundleVersion = Self.bundleVersionString()
        let storedVersion = defaults.string(forKey: Keys.currentVersion)

        // Increment lifetime launches / uses
        lifetimeLaunchCount += 1
        defaults.set(lifetimeLaunchCount, forKey: Keys.lifetimeLaunchCount)

        // Version-specific launches
        if storedVersion == currentBundleVersion {
            versionLaunchCount += 1
            defaults.set(versionLaunchCount, forKey: Keys.versionLaunchCount)
        } else {
            defaults.set(currentBundleVersion, forKey: Keys.currentVersion)
            let updateDate = Date()
            defaults.set(updateDate, forKey: Keys.currentVersionInstallDate)
            self.currentVersionInstallDate = updateDate
            self.versionLaunchCount = 1
            defaults.set(1, forKey: Keys.versionLaunchCount)
            print("🚀 [AppReviewManager] App updated to \(currentBundleVersion). Reset version launch count.")
        }

        print("📊 [AppReviewManager] Launch tracked: Lifetime=\(lifetimeLaunchCount), Version=\(versionLaunchCount), DaysInstall=\(daysSinceOriginalInstall), DaysUpdate=\(daysSinceCurrentVersionUpdate), ExistingUser=\(isExistingUser)")

        checkAndRequestReviewIfAppropriate()
    }

    /// Called when the app transitions into the background.
    public func handleAppBackground() {
        cancelScheduledPrompt()
    }

    /// Called when the app transitions into the foreground (e.g. from background).
    public func handleAppForeground() {
        checkAndRequestReviewIfAppropriate()
    }

    /// Evaluates review prompt criteria and, if satisfied, schedules presentation after exactly 11 seconds.
    public func checkAndRequestReviewIfAppropriate() {
        guard shouldRequestReview else {
            return
        }

        guard scheduledPromptTask == nil else {
            // Already scheduled and counting down 11 seconds
            return
        }

        isPromptScheduled = true
        print("⏳ [AppReviewManager] Criteria satisfied. Scheduling StoreKit review dialog in 11 seconds...")

        scheduledPromptTask = Task { @MainActor [weak self] in
            // Wait exactly 11 seconds for user to settle into their session
            do {
                try await Task.sleep(nanoseconds: 11 * 1_000_000_000)
            } catch {
                // Task was canceled (e.g. app backgrounded or review submitted)
                self?.isPromptScheduled = false
                self?.scheduledPromptTask = nil
                return
            }

            guard let self = self, !Task.isCancelled else { return }
            self.isPromptScheduled = false
            self.scheduledPromptTask = nil

            // Re-verify criteria before prompting
            guard self.shouldRequestReview else { return }

            self.presentStoreKitReview()
        }
    }

    /// Cancels any in-flight 11-second delayed review prompt (e.g. if the user backgrounded the app).
    public func cancelScheduledPrompt() {
        if let task = scheduledPromptTask {
            task.cancel()
            scheduledPromptTask = nil
            isPromptScheduled = false
            print("⏸️ [AppReviewManager] Cancelled in-flight scheduled review prompt.")
        }
    }

    // MARK: - StoreKit Presentation

    private func presentStoreKitReview() {
        #if os(iOS)
        // Triple-check: permanently blocked if review has already been submitted
        guard !hasSubmittedReview,
              !UserDefaults.standard.bool(forKey: Keys.hasSubmittedReview),
              !Self.isReviewSubmittedPersistently() else {
            print("🔒 [AppReviewManager] Blocked StoreKit review presentation: review has already been submitted.")
            return
        }

        guard let windowScene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }) else {
            print("⚠️ [AppReviewManager] No foreground active UIWindowScene found. Will re-evaluate on next foreground.")
            return
        }

        // Record prompt timestamp and launch count
        let now = Date()
        self.lastPromptDate = now
        self.lastPromptLaunchCount = self.lifetimeLaunchCount

        let defaults = UserDefaults.standard
        defaults.set(now, forKey: Keys.lastPromptDate)
        defaults.set(self.lifetimeLaunchCount, forKey: Keys.lastPromptLaunchCount)

        print("⭐️ [AppReviewManager] Presenting StoreKit in-app review dialog via windowScene at lifetime launch #\(self.lifetimeLaunchCount)...")

        if #available(iOS 16.0, *) {
            AppStore.requestReview(in: windowScene)
        } else {
            SKStoreReviewController.requestReview(in: windowScene)
        }
        #endif
    }

    // MARK: - Permanent Lockout

    /// Call this whenever the user performs an explicit in-app review action
    /// or confirms submitting a review to permanently disable all future automatic prompts.
    public func markReviewSubmitted() {
        cancelScheduledPrompt()
        hasSubmittedReview = true
        UserDefaults.standard.set(true, forKey: Keys.hasSubmittedReview)
        Self.writePersistentMarker()
        print("🌟 [AppReviewManager] Review submitted confirmed. Review prompts are permanently locked out forever.")
    }

    /// Opens the official App Store product page directly to the Write Review sheet,
    /// and marks the review as submitted to permanently lock out automated prompts.
    public func openAppStoreReviewPage(appId: String = "6740889988") {
        markReviewSubmitted()
        #if os(iOS)
        if let url = URL(string: "itms-apps://itunes.apple.com/app/id\(appId)?action=write-review"),
           UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        } else if let webUrl = URL(string: "https://apps.apple.com/app/id\(appId)?action=write-review") {
            UIApplication.shared.open(webUrl, options: [:], completionHandler: nil)
        }
        #endif
    }

    // MARK: - Testing & Diagnostics Helper

    /// Resets all review tracking data in `UserDefaults` for testing and verification purposes.
    public func resetAllReviewDataForTesting() {
        cancelScheduledPrompt()
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: Keys.hasSubmittedReview)
        defaults.removeObject(forKey: Keys.originalInstallDate)
        defaults.removeObject(forKey: Keys.lifetimeLaunchCount)
        defaults.removeObject(forKey: Keys.currentVersion)
        defaults.removeObject(forKey: Keys.currentVersionInstallDate)
        defaults.removeObject(forKey: Keys.versionLaunchCount)
        defaults.removeObject(forKey: Keys.lastPromptDate)
        defaults.removeObject(forKey: Keys.lastPromptLaunchCount)

        Self.removePersistentMarker()

        self.hasSubmittedReview = false
        self.lifetimeLaunchCount = 0
        self.versionLaunchCount = 0
        self.originalInstallDate = Date()
        self.currentVersionInstallDate = Date()
        self.lastPromptDate = nil
        self.lastPromptLaunchCount = 0
        self.isPromptScheduled = false
        self.hasTrackedLaunchThisSession = false
        print("🔄 [AppReviewManager] All review tracking data has been reset.")
    }
}

// MARK: - SwiftUI View Lifecycle Modifier

public struct AppReviewLifecycleModifier: ViewModifier {
    @Environment(\.scenePhase) private var scenePhase

    public func body(content: Content) -> some View {
        content
            .onAppear {
                AppReviewManager.shared.trackAppLaunchAndCheck()
            }
            .onChange(of: scenePhase) { _, newPhase in
                switch newPhase {
                case .active:
                    AppReviewManager.shared.handleAppForeground()
                case .background:
                    AppReviewManager.shared.handleAppBackground()
                case .inactive:
                    AppReviewManager.shared.cancelScheduledPrompt()
                @unknown default:
                    break
                }
            }
            #if os(iOS)
            .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
                AppReviewManager.shared.handleAppForeground()
            }
            .onReceive(NotificationCenter.default.publisher(for: UIApplication.didEnterBackgroundNotification)) { _ in
                AppReviewManager.shared.handleAppBackground()
            }
            #endif
    }
}

extension View {
    /// Automatically tracks app launches and foreground transitions for StoreKit reviews.
    public func trackAppReviewLifecycle() -> some View {
        self.modifier(AppReviewLifecycleModifier())
    }
}
