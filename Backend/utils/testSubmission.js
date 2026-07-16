// Answer key lives only on the server - never sent to the client.
// Each question has an id, category (la = logical aptitude, code = coding),
// text, options, and the correct option index.

export const QUESTIONS = [
    // Logical Aptitude
    {
        id: "la1",
        category: "la",
        text: "If all Bloops are Razzies and all Razzies are Lazzies, then all Bloops are definitely Lazzies. True or False?",
        options: ["True", "False", "Cannot be determined", "Only sometimes"],
        correct: 0,
    },
    {
        id: "la2",
        category: "la",
        text: "What comes next in the sequence: 2, 6, 12, 20, 30, ?",
        options: ["36", "40", "42", "44"],
        correct: 2,
    },
    {
        id: "la3",
        category: "la",
        text: "A is the mother of B. B is the father of C. How is A related to C?",
        options: ["Aunt", "Grandmother", "Sister", "Mother"],
        correct: 1,
    },
    {
        id: "la4",
        category: "la",
        text: "Which number does not belong: 8, 27, 64, 100, 125?",
        options: ["8", "27", "100", "125"],
        correct: 2,
    },
    {
        id: "la5",
        category: "la",
        text: "If today is Wednesday, what day will it be 100 days from now?",
        options: ["Monday", "Tuesday", "Thursday", "Friday"],
        correct: 2,
    },
    // Coding
    {
        id: "code1",
        category: "code",
        text: "What is the time complexity of binary search on a sorted array?",
        options: ["O(n)", "O(log n)", "O(n log n)", "O(1)"],
        correct: 1,
    },
    {
        id: "code2",
        category: "code",
        text: "In JavaScript, what does `[1, 2, 3].map(x => x * 2)` return?",
        options: ["[1, 2, 3]", "[2, 4, 6]", "6", "undefined"],
        correct: 1,
    },
    {
        id: "code3",
        category: "code",
        text: "Which data structure uses FIFO (First In First Out) ordering?",
        options: ["Stack", "Queue", "Tree", "Heap"],
        correct: 1,
    },
    {
        id: "code4",
        category: "code",
        text: "What does `Promise.all([p1, p2])` do?",
        options: [
            "Resolves as soon as any one promise resolves",
            "Runs p1 and p2 sequentially",
            "Resolves when all promises resolve, or rejects if any rejects",
            "Cancels p2 if p1 fails",
        ],
        correct: 2,
    },
    {
        id: "code5",
        category: "code",
        text: "What is the output of `typeof null` in JavaScript?",
        options: ["'null'", "'undefined'", "'object'", "'number'"],
        correct: 2,
    },
];

// Sent to the client - strips the correct answer
export function publicQuestions() {
    return QUESTIONS.map(({ id, category, text, options }) => ({
        id,
        category,
        text,
        options,
    }));
}