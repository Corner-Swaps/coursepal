import SwiftUI
import SwiftData

/// Feature 2: Interactive Grade Weight Tracker & Target Calculator Component
public struct GradeWeightTrackerView: View {
    public let course: Course
    @State private var desiredGrade: Double = 90.0

    public init(course: Course) {
        self.course = course
    }

    private var allAssignments: [Assignment] {
        course.assignments.filter { !$0.isDeleted }
    }

    private var rawTotalWeightPercentage: Int {
        var total: Double = 0
        for assign in allAssignments {
            if let wt = assign.weightPercentage {
                let clean = wt.replacingOccurrences(of: "%", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
                if let val = Double(clean) {
                    total += val
                } else {
                    let digits = wt.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
                    if let val = Double(digits) {
                        total += val
                    }
                }
            }
        }
        return Int(round(total))
    }

    private var totalWeightPercentage: Int {
        return rawTotalWeightPercentage > 0 ? min(100, rawTotalWeightPercentage) : 100
    }

    private var completedWeightPercentage: Int {
        var total: Double = 0
        for assign in allAssignments where assign.isCompleted {
            if let wt = assign.weightPercentage {
                let clean = wt.replacingOccurrences(of: "%", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
                if let val = Double(clean) {
                    total += val
                } else {
                    let digits = wt.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
                    if let val = Double(digits) {
                        total += val
                    }
                }
            }
        }
        return min(100, Int(round(total)))
    }

    private var courseColor: Color {
        CourseColorHelper.color(for: course.hexColor)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            // Header Title
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "chart.bar.fill")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(courseColor)
                    Text("GRADE WEIGHT TRACKER")
                        .font(.cpItemTitle)
                        .foregroundColor(courseColor)
                }

                Spacer()

                if rawTotalWeightPercentage > 100 {
                    Text("Total \(rawTotalWeightPercentage)% (Adjust Weight)")
                        .font(.cpDescriptionBold)
                        .foregroundColor(.red)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.red.opacity(0.12))
                        .cornerRadius(6)
                }

                Text("Target: \(Int(desiredGrade))%")
                    .font(.cpDescriptionBold)
                    .foregroundColor(CoursePalTheme.textDark)
            }

            // Multi-Color Progress Bar Breakdown
            VStack(alignment: .leading, spacing: 6) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color(red: 0.92, green: 0.94, blue: 0.97))
                            .frame(height: 12)

                        RoundedRectangle(cornerRadius: 8)
                            .fill(courseColor)
                            .frame(width: geo.size.width * CGFloat(min(1.0, Double(completedWeightPercentage) / 100.0)), height: 12)
                    }
                }
                .frame(height: 12)

                HStack {
                    Text("\(completedWeightPercentage)% Completed")
                        .font(.cpDescriptionBold)
                        .foregroundColor(courseColor)

                    Spacer()

                    Text("\(100 - completedWeightPercentage)% Remaining")
                        .font(.cpDescription)
                        .foregroundColor(CoursePalTheme.textMuted)
                }
            }

            // Target Grade Stepper / Slider
            HStack {
                Text("Desired Course Grade:")
                    .font(.cpDescriptionMedium)
                    .foregroundColor(CoursePalTheme.textDark)

                Spacer()

                Slider(value: $desiredGrade, in: 70...100, step: 1)
                    .frame(width: 120)
                    .tint(courseColor)

                Text("\(Int(desiredGrade))%")
                    .font(.cpDescriptionBold)
                    .foregroundColor(courseColor)
                    .frame(width: 45, alignment: .trailing)
            }
            .padding(.top, 4)
        }
        .padding(14)
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.03), radius: 6, x: 0, y: 2)
    }
}
