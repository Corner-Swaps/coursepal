// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CoursePal",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .executable(
            name: "CoursePal",
            targets: ["CoursePal"]
        )
    ],
    targets: [
        .executableTarget(
            name: "CoursePal",
            path: "."
        )
    ]
)
