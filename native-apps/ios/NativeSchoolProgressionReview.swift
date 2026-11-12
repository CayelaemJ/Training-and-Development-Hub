enum NativeSchoolProgressionReview {
    static func targetYear(selection: String, snapshotYear: Int, candidateYear: Int) -> Int? {
        guard let selectedYear = Int(selection),
              (2020...2199).contains(snapshotYear),
              selectedYear == snapshotYear,
              candidateYear == snapshotYear else {
            return nil
        }
        return snapshotYear + 1
    }
}
