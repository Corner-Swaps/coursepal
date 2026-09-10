const http = require('http');

const data = {
    title: "CS 450: Machine Learning",
    code: "CS450",
    instructorName: "Dr. Alan Turing",
    instructorEmail: "aturing@university.edu",
    weeks: [
        {
            weekNumber: 1,
            title: "Introduction to ML",
            readings: [
                { title: "Chapter 1: The Learning Problem", pages: "1-20", isCompleted: true },
                { title: "Chapter 2: Linear Regression", pages: "21-45", isCompleted: false }
            ],
            assignments: [
                { title: "Problem Set 1", type: "Homework", dueDate: "2026-09-05", weight: 10, isCompleted: true }
            ]
        },
        {
            weekNumber: 2,
            title: "Neural Networks & Deep Learning",
            readings: [
                { title: "Chapter 3: Perceptrons", pages: "46-70", isCompleted: false }
            ],
            assignments: [
                { title: "Programming Project 1", type: "Project", dueDate: "2026-09-12", weight: 20, isCompleted: false }
            ]
        }
    ]
};

const req = http.request('http://localhost:3088/api/courses', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-user-id': '00000000-0000-0000-0000-000000000001'
    }
}, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => console.log('Response:', body));
});
req.write(JSON.stringify(data));
req.end();
