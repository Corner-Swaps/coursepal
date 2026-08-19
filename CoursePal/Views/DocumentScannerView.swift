#if os(iOS)
import SwiftUI
import VisionKit
import UIKit

public struct DocumentScannerView: UIViewControllerRepresentable {
    @Environment(\.presentationMode) private var presentationMode
    public var onScanCompleted: ([UIImage]) -> Void
    public var onCancel: () -> Void

    public init(onScanCompleted: @escaping ([UIImage]) -> Void, onCancel: @escaping () -> Void) {
        self.onScanCompleted = onScanCompleted
        self.onCancel = onCancel
    }

    public func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let scannerViewController = VNDocumentCameraViewController()
        scannerViewController.delegate = context.coordinator
        return scannerViewController
    }

    public func updateUIViewController(_ uiViewController: VNDocumentCameraViewController, context: Context) {}

    public func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    public final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        private let parent: DocumentScannerView

        init(_ parent: DocumentScannerView) {
            self.parent = parent
        }

        public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
            var scannedImages: [UIImage] = []
            var lowSharpnessDetected = false

            for i in 0..<scan.pageCount {
                let image = scan.imageOfPage(at: i)
                scannedImages.append(image)

                if !isImageSharpEnough(image) {
                    lowSharpnessDetected = true
                }
            }

            if lowSharpnessDetected {
                print("[Camera Scanner Warning] Blurry or low resolution scan detected. Prompting user to verify lighting & bounds overlay.")
            }

            parent.onScanCompleted(scannedImages)
            parent.presentationMode.wrappedValue.dismiss()
        }

        private func isImageSharpEnough(_ image: UIImage) -> Bool {
            guard let cgImage = image.cgImage else { return false }
            let width = cgImage.width
            let height = cgImage.height
            return width >= 600 && height >= 600
        }

        public func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
            parent.onCancel()
            parent.presentationMode.wrappedValue.dismiss()
        }

        public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
            print("VisionKit scanner error: \(error.localizedDescription)")
            parent.onCancel()
            parent.presentationMode.wrappedValue.dismiss()
        }
    }
}
#else
import SwiftUI

public struct DocumentScannerView: View {
    public var onScanCompleted: (Any) -> Void
    public var onCancel: () -> Void

    public init(onScanCompleted: @escaping (Any) -> Void, onCancel: @escaping () -> Void) {
        self.onScanCompleted = onScanCompleted
        self.onCancel = onCancel
    }

    public var body: some View {
        VStack(spacing: 16) {
            Text("Document Scanner unavailable on macOS")
                .font(.headline)
            Button("Dismiss") {
                onCancel()
            }
        }
        .padding()
    }
}
#endif
