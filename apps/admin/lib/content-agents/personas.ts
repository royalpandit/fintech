/**
 * The name each desk posts under.
 *
 * The brief is explicit: a post must read as one written by a normal Indian
 * retail investor, with no "agent", "AI" or desk label anywhere near it — and
 * the display name is part of that. So the feed shows a person's name, not
 * "Finuer Pre-Market Master", which is what these accounts were called before.
 *
 * Fixed and ordered, never random: the name is the account's identity, and an
 * account that is called something else after a reseed looks like a different
 * person took over the same posts. Index 0 is agent 1.
 *
 * The bot's email still says what it is (agent.<slug>@bots.finuer.com) because
 * operators need to find these rows; no feed endpoint selects a user's email.
 *
 * Market posts additionally carry AGENT_DISCLAIMER, so the reader is told the
 * post is machine-written even though the name is a person's.
 */

const PERSONAS = [
  "Aarav Mehta",        // 1
  "Nikhil Joshi",       // 2
  "Priya Raghavan",     // 3
  "Sandeep Bhatia",     // 4
  "Ritika Sahu",        // 5
  "Varun Kulkarni",     // 6
  "Megha Dubey",        // 7
  "Arjun Pillai",       // 8
  "Shruti Kamath",      // 9
  "Imran Qureshi",      // 10
  "Deepak Rathore",     // 11
  "Ananya Bose",        // 12
  "Karan Ahluwalia",    // 13
  "Sneha Patil",        // 14
  "Rahul Vaidyanathan", // 15
  "Pooja Chandak",      // 16
  "Siddharth Menon",    // 17
  "Neha Trivedi",       // 18
  "Vikas Dhanuka",      // 19
  "Tanvi Shirke",       // 20
  "Manish Gowda",       // 21
  "Ayesha Shaikh",      // 22
  "Harsh Vora",         // 23
  "Divya Nambiar",      // 24
  "Prateek Saxena",     // 25
  "Kavya Reddy",        // 26
  "Gaurav Bansal",      // 27
  "Ritu Deshmukh",      // 28
  "Abhishek Nair",      // 29
  "Swati Agrawal",      // 30
  "Nitin Lohia",        // 31
  "Farhan Memon",       // 32
  "Lakshmi Iyer",       // 33
  "Rohan Barve",        // 34
  "Simran Kaur",        // 35
  "Tushar Ghosh",       // 36
  "Bhavna Solanki",     // 37
  "Yashwant Pawar",     // 38
  "Ira Chatterjee",     // 39
  "Mohit Khandelwal",   // 40
  "Sarita Mahajan",     // 41
  "Kunal Dhar",         // 42
  "Reema Thakkar",      // 43
  "Devansh Oza",        // 44
  "Nandini Rao",        // 45
  "Aakash Grover",      // 46
  "Ipsita Mohanty",     // 47
  "Rajat Sethi",        // 48
  "Charu Bajpai",       // 49
  "Omkar Sawant",       // 50
  "Zoya Ansari",        // 51
  "Praveen Kashyap",    // 52
  "Meenal Khurana",     // 53
  "Sahil Chhabra",      // 54
  "Tara Krishnan",      // 55
  "Dhruv Talwar",       // 56
  "Anjali Wadhwa",      // 57
  "Suresh Pattnaik",    // 58
  "Jyoti Rawat",        // 59
  "Faizan Khan",        // 60
  "Alok Mitra",         // 61
  "Preeti Sundaram",    // 62
  "Vivek Chaudhary",    // 63
  "Rhea Fernandes",     // 64
  "Mayank Tiwari",      // 65
  "Sunita Borkar",      // 66
  "Parth Vyas",         // 67
  "Nisha Chourasia",    // 68
  "Ramesh Pathak",      // 69
  "Aditi Konar",        // 70
  "Jatin Lalwani",      // 71
  "Sweta Mishra",       // 72
  "Hemant Barot",       // 73
  "Kirti Bhardwaj",     // 74
  "Anirudh Salvi",      // 75
  "Payal Jindal",       // 76
  "Naveen Acharya",     // 77
  "Ruchi Kabra",        // 78
  "Sameer Zaveri",      // 79
  "Lata Pandey",        // 80
  "Rakesh Dalmia",      // 81
  "Vidya Shenoy",       // 82
  "Amit Bagri",         // 83
  "Pallavi Mhatre",     // 84
  "Shantanu Karkera",   // 85
  "Heena Chawla",       // 86
  "Girish Hegde",       // 87
  "Mitali Dasgupta",    // 88
  "Zubin Patel",        // 89
  "Richa Goenka",       // 90
  "Ashwin Raikar",      // 91
  "Komal Sabharwal",    // 92
  "Dev Bhattacharya",   // 93
  "Priyanka Nadkarni",  // 94
  "Sachin Kothari",     // 95
  "Aparna Velu",        // 96
  "Rizwan Shah",        // 97
  "Ved Suthar",         // 98
  "Smita Chopra",       // 99
  "Arnav Bhattacharjee", // 100
] as const;

if (new Set(PERSONAS).size !== PERSONAS.length || PERSONAS.length !== 100) {
  throw new Error("personas must be 100 distinct names");
}

/** The display name for agent 1–100. */
export function personaForAgent(agentNo: number): string {
  const name = PERSONAS[agentNo - 1];
  if (!name) throw new Error(`no persona for agent ${agentNo}`);
  return name;
}
