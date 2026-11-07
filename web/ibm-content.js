export const BOOT = [
  "Personal Computer BASIC Version 1.10",
  "Copyright (C) 1984, Sakina Saifuddin",
  "61440 Bytes free",
  "",
  "Hi! Type ABOUT to start, or HELP."
];

// function-key bar on the bottom row (F1..F5, or click)
export const BAR = [
  {key: "1", label: "ABOUT", cmd: "ABOUT"},
  {key: "2", label: "ONLINE", cmd: "ONLINE"},
  {key: "3", label: "HELP", cmd: "HELP"},
  {key: "4", label: "FILES", cmd: "FILES"},
  {key: "5", label: "RUN", cmd: "RUN"}
];

// \u0001 ... \u0002 marks the bright (white-green) words, like the command names on the reference HELP screen
const hi = (t) => "\u0001" + t + "\u0002";

// the "ONLINE" screen (a bulletin-board style links page)
export const BBS = {
  title: "SAKINA BBS",
  banner: "SAKINA",
  tagline: "Node 1 of 1  \u00b7  28800 bps  \u00b7  always open",
  intro: "Where else to find me:",
  links: [
    {label: "Email", shown: "sakinasaifee006@gmail.com", href: "mailto:sakinasaifee006@gmail.com"},
    {label: "LinkedIn", shown: "linkedin.com/in/sakinasaifuddin", href: "https://www.linkedin.com/in/sakinasaifuddin/"},
    {label: "GitHub", shown: "github.com/sakina-saifuddin", href: "https://github.com/sakina-saifuddin"},
    {label: "Ask me", shown: "askksakina.netlify.app", href: "https://askksakina.netlify.app"}
  ],
  prompt: "Press 1-4 or click a line to open it. Q hangs up.",
  bottom: "1-4 open  L links  Q hang up"
};

const about = [
  "Hi, I'm Sakina Saifuddin.",
  "Software engineer and data scientist in Houston, Texas, with 3.5+ years across software, data, automation and machine learning.",
  "",
  "I started in code. In 2021 I began a computer science degree at Iqra University in Karachi and, the same year, started building real apps at SoftSyncDev with React Native, Node.js and AWS. One early win: a fitness app whose videos took about five minutes to load now loads them in about three seconds.",
  "",
  "In 2022 I took a second job reading data about people. At The Walnut Agency I managed 70+ client accounts and used campaign data to grow engagement by 60%+. That is where numbers started to explain behavior for me.",
  "",
  "I wanted to work with the data itself, so I moved into business intelligence. At BluTech Consulting I built Power BI and Tableau dashboards on SQL for a major bank. My dashboards and SQL now sit behind 1,074 automated reports.",
  "",
  "Then machine learning. A research project on classifying seizures from EEG data pulled me in, and in 2025 I started a Master's in Engineering Data Science and AI at the University of Houston.",
  "",
  "I am not a healthcare-only candidate. I have trained EEG classifiers, chest X-ray GANs and healthcare data pipelines. I have also forecast retail demand over 3 million records, built finance pipelines, shipped mobile apps and run marketing analytics. I do all of it.",
  "",
  "Hackathons are my second passion. At CodeRED Orion, the University of Houston's biggest hackathon, I led our team to 2nd place out of 70+ teams and the Best Pitch/Demo award with Power Guard 360. I keep signing up for more.",
  "",
  "I am also lazy, on purpose. If I hate doing something by hand, I automate it. I automated my own job search: Sakina Job OS is a 12-stage agent that finds postings, checks fit, writes my resume and cover letter, finds warm LinkedIn contacts and drafts follow-ups. A human review step stops anything going out without me.",
  "",
  "My aim: become an AI engineer who builds automation, the agents and pipelines that remove the manual work people hate doing.",
  "",
  "Type ROLES to see what I am looking for."
];

const roles = [
  "I am looking for early-career roles, internships and co-ops as:",
  "",
  "  AI Engineer",
  "  AI Automation Engineer",
  "  Machine Learning Engineer",
  "  Data Scientist",
  "",
  "Healthcare, finance, retail, marketing. The domain matters less to me than the problem: something slow, manual or repetitive that a good system can take over.",
  "",
  "Based in Houston, Texas."
];

const work = [
  "5 roles so far:",
  "",
  "Feb 2026 - Present",
  "  BI & Automation Intern, TMAC / NIST-MEP",
  "May 2026 - Sep 2026",
  "  AI Automation Engineer, Dental-X AI",
  "May 2024 - Aug 2025",
  "  Business Intelligence Consultant, BluTech Consulting",
  "Aug 2022 - Sep 2025",
  "  Sr. Performance Management Analyst, The Walnut Agency",
  "Jan 2021 - May 2024",
  "  Software Engineer, SoftSyncDev",
  "",
  "Education: MS Engineering Data Science and AI, University of Houston (2025 - now). BS Computer Science, Iqra University (GPA 3.71, Gold Medalist)."
];

const projects = [
  "11 project books at askksakina.netlify.app. The big ones:",
  "",
  "1  Power Guard 360. Predicts power plant turbine failures. 2nd place at CodeRED Orion.",
  "2  Sakina Job OS. 12-stage n8n agent that runs my job search.",
  "3  Retail Forecasting. 3M+ records, LightGBM beat two other models.",
  "4  Grant Dashboards. Power BI plus Databricks, a two-day prep step automated.",
  "5  Oracle Financial ETL. Python pipeline from Oracle exports to Power BI.",
  "6  Pneumonia X-ray GAN. Accuracy from 73.56% to 82.21%.",
  "7  EEG Seizure Detection. Deep learning on brain signals.",
  "8  Healthcare Eligibility Pipeline. Many payers, one benefit summary.",
  "9  Cost Center App. Monthly sign-off in Power Apps and SharePoint.",
  "10 Fitness Video Fix. Five minutes down to about three seconds."
];

const hacks = [
  "Hackathons are my second passion.",
  "",
  "CodeRED Orion, University of Houston, 70+ teams.",
  "I led our team to 2nd place and the Best Pitch/Demo award ($500) with Power Guard 360.",
  "",
  "Two Random Forest models watch every turbine's sensor data and flag failures with the reasons behind them. A live Arduino sensor board drives one turbine and watches for gas leaks, a 3D digital twin shows the whole plant, and the engineer's phone app takes them to the job.",
  "",
  "Fast build, clear story, working demo. That is the part I enjoy."
];

const contact = [
  "Open to internships, co-ops and early-career roles.",
  "",
  "Email     sakinasaifee006@gmail.com",
  "LinkedIn  linkedin.com/in/sakinasaifuddin",
  "GitHub    github.com/sakina-saifuddin",
  "Ask me    askksakina.netlify.app",
  "",
  "Type EMAIL, LINKEDIN, GITHUB or ASK to open one."
];

const help = [
  hi("ABOUT") + "     who I am (F1)",
  hi("ONLINE") + "    where else to find me (F2)",
  hi("SNAKE BLOCKS ZOMBIE") + "  games",
  hi("DEMO") + "      the screensaver",
  hi("OPTIONS") + "   other versions of things",
  hi("DEBUG") + "     fly around the room",
  hi("WORK") + "      where I have worked",
  hi("PROJECTS") + "  what I have built",
  hi("HACKS") + "     hackathons",
  hi("ROLES") + "     what I am looking for",
  hi("EMAIL LINKEDIN GITHUB ASK") + " open one",
  hi("SYSTEM") + "    back to the desk",
  "",
  hi("Programs"),
  "  " + hi("FILES") + "     what's on the disk",
  "  " + hi("RUN \"x\"") + "   run one, like RUN \"HELLO\"",
  "  " + hi("LIST") + "      show it   NEW  EDIT n",
  "  " + hi("TRON") + "      show line numbers as it runs",
  "  " + hi("SAVE \"x\"") + "  DELETE n  TROFF",
  "",
  hi("BASIC"),
  "  " + hi("PRINT INPUT LET IF GOTO GOSUB FOR NEXT"),
  "  " + hi("WHILE WEND DATA READ DIM END CLS BEEP"),
  "  Start a line with a number to write",
  "  your own program, then type RUN.",
  "",
  "Ctrl+C stops a program. Q leaves a game."
];

export const commands = {
  ABOUT: {lines: about},
  ROLES: {lines: roles},
  AIM: {lines: roles},
  WORK: {lines: work},
  EXPERIENCE: {lines: work},
  PROJECTS: {lines: projects},
  HACKS: {lines: hacks},
  HACKATHONS: {lines: hacks},
  CONTACT: {online: true},
  ONLINE: {online: true},
  HELP: {lines: help},
  EMAIL: {href: "mailto:sakinasaifee006@gmail.com", lines: ["Opening your mail app."]},
  LINKEDIN: {href: "https://www.linkedin.com/in/sakinasaifuddin/", lines: ["Opening LinkedIn in a new tab."]},
  GITHUB: {href: "https://github.com/sakina-saifuddin", lines: ["Opening GitHub in a new tab."]},
  ASK: {href: "https://askksakina.netlify.app", lines: ["Opening AskSakina in a new tab."]}
};

// the programs on the "disk" (FILES lists them, RUN "name" loads and runs one)
export const PROGRAMS = {
  HELLO: [
    '10 REM HELLO',
    '20 INPUT "What is your name"; N$',
    '30 PRINT "Hello, "; N$; "!"',
    '40 PRINT "Welcome to my computer."',
    '50 PRINT "Type ABOUT to read my story."'
  ],
  SQUARES: [
    '10 REM SQUARES',
    '20 FOR I = 1 TO 10',
    '30 PRINT I; "squared is"; I * I',
    '40 NEXT I'
  ],
  GUESS: [
    '10 REM GUESS THE NUMBER',
    '20 N = INT(RND * 100) + 1',
    '30 T = 0',
    '40 PRINT "I am thinking of a number from 1 to 100."',
    '50 INPUT "Your guess"; G',
    '60 T = T + 1',
    '70 IF G < N THEN PRINT "Too low.": GOTO 50',
    '80 IF G > N THEN PRINT "Too high.": GOTO 50',
    '90 PRINT "Yes! You got it in"; T; "guesses."'
  ],
  SKILLS: [
    '10 REM THINGS I WORK WITH',
    '20 PRINT "Things I work with:"',
    '30 READ S$',
    '40 IF S$ = "END" THEN END',
    '50 PRINT "  "; S$',
    '60 GOTO 30',
    '70 DATA Python, SQL, Power BI, Tableau, Databricks, LightGBM, n8n, React Native, Node.js, AWS, END'
  ]
};
