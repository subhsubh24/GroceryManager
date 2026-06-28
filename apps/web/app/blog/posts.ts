export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  readMinutes: number;
  keywords: string[];
  sections: { heading: string; body: string[] }[];
  ctaHeading: string;
  ctaBody: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "reduce-food-waste-at-home",
    title: "7 practical ways to reduce food waste at home",
    description:
      "The average UK household throws away £730 worth of food every year. Here's how to cut that down without overhauling your routine.",
    publishedAt: "2026-06-01",
    readMinutes: 6,
    keywords: ["food waste", "reduce food waste", "food waste reduction", "household food waste"],
    sections: [
      {
        heading: "Know what you already have",
        body: [
          "The most common cause of food waste isn't buying too much — it's buying duplicates of things you forgot you had. A jar of pesto pushed to the back of the fridge. Tinned tomatoes hiding behind the cereal. A second bag of rice opened before the first was finished.",
          "The fix is surprisingly simple: keep a running list of what's in your kitchen. It doesn't have to be perfect. Even a rough mental inventory helps you avoid the 'I thought we were out' duplicate purchase.",
        ],
      },
      {
        heading: "First in, first out",
        body: [
          "Restaurants use a stock-rotation principle called FIFO — first in, first out. Newer stock goes to the back; older stock gets used first. Apply the same logic to your fridge and cupboards.",
          "When you unpack a shop, put the new items behind the existing ones. This sounds tedious but takes about 30 seconds once it becomes habit. It means you're always reaching for the thing that's closest to its use-by date.",
        ],
      },
      {
        heading: "Shop from what you have",
        body: [
          "Most people build a shopping list and then check the fridge. Try reversing it: check the fridge first, cook from what's there, and only list what's genuinely missing.",
          "This one change — building meals around existing pantry items rather than the other way around — is the highest-leverage habit shift you can make. It reduces waste because it forces you to use what's already there before it expires.",
        ],
      },
      {
        heading: "Understand 'best before' vs 'use by'",
        body: [
          "'Use by' dates are safety dates — the food should not be eaten after this point. 'Best before' dates are quality dates — the food is safe to eat after this date but may be past its peak flavour or texture.",
          "A lot of food gets thrown away unnecessarily because people confuse the two. Hard cheeses, dried pasta, tinned goods, and most dry ingredients can be used well after their best-before date. Use your judgement (smell and look) rather than treating best-before as a hard expiry.",
        ],
      },
      {
        heading: "Freeze more",
        body: [
          "The freezer is the most underused appliance in most kitchens. Bread going stale? Freeze it. Half a tin of coconut milk? Freeze it in an ice cube tray. Leftover rice? Freeze it in portions.",
          "Most cooked meals freeze well. Soups, stews, curries, pasta sauces — batch cooking and freezing portions means you always have something ready and nothing goes in the bin.",
        ],
      },
      {
        heading: "Track your waste",
        body: [
          "If you want to reduce something, measure it. Keep a tally for two weeks of what you throw away and why. The pattern is almost always the same: a few recurring items (fresh herbs, salad leaves, bread) account for the bulk of the waste.",
          "Once you know your waste patterns, you can fix them specifically — buy smaller quantities of the high-waste items, switch to frozen herbs, only buy salad when you have a plan to eat it within two days.",
        ],
      },
      {
        heading: "Use a pantry tracker",
        body: [
          "The above habits are more effective when you have visibility into your kitchen. A pantry tracker — whether it's a notes app, a whiteboard on the fridge, or a dedicated app — gives you the inventory awareness that makes the other habits automatic.",
          "The best systems update themselves from your receipts so you don't have to do manual data entry. When the tracker is accurate and current, you stop buying duplicates, you cook from what's nearly expired first, and your shopping list matches what you actually need.",
        ],
      },
    ],
    ctaHeading: "Let your kitchen track itself",
    ctaBody:
      "GroceryManager builds your pantry from your receipts automatically. It knows what's running low, what's about to expire, and what to cook tonight — so you stop buying things you already have and stop throwing away things you forgot about.",
  },
  {
    slug: "meal-planning-for-beginners",
    title: "Meal planning for beginners: a realistic guide",
    description:
      "Most meal planning guides assume you have time and enthusiasm. This one doesn't. Here's a simpler approach that actually sticks.",
    publishedAt: "2026-06-08",
    readMinutes: 7,
    keywords: [
      "meal planning",
      "meal planning tips",
      "meal planner",
      "meal plan beginners",
      "weekly meal plan",
    ],
    sections: [
      {
        heading: "Why most meal plans fail",
        body: [
          "The classic approach: sit down on Sunday, plan seven dinners, write a shopping list, do a big shop, cook from scratch every night. It sounds reasonable. In practice, it collapses by Tuesday.",
          "Life doesn't match the plan. You work late. You're not in the mood for what you planned. You forgot to defrost something. The plan becomes a source of guilt rather than help.",
          "A more durable approach plans loosely, uses what's already there, and stays flexible.",
        ],
      },
      {
        heading: "Start with what's already in your kitchen",
        body: [
          "Before you plan anything, check what you have. Open the fridge, look in the cupboards, note what's about to run out. This step takes five minutes and changes everything.",
          "Most people have enough ingredients for two or three meals they hadn't thought of. Building your plan around what's already there reduces your shopping list, reduces waste, and means you're not starting from a blank page every week.",
        ],
      },
      {
        heading: "Plan four meals, not seven",
        body: [
          "Don't plan seven dinners. Plan four. One or two nights you'll eat leftovers. One night something will come up and you'll order in. Planning for seven leaves no room for real life.",
          "Pick four meals that use overlapping ingredients — a protein used on Monday gets repurposed in a different dish on Wednesday. This reduces waste and means one shop covers multiple meals.",
        ],
      },
      {
        heading: "Build around a protein and a carb",
        body: [
          "The simplest meal-planning unit is: pick a protein (chicken, lentils, eggs, fish), pick a carb (pasta, rice, potatoes, bread), add whatever vegetables you have. That structure covers 90% of weeknight cooking.",
          "Once you're comfortable with that structure, you can vary the cuisine (Italian one night, South Asian the next) while still using the same basic planning logic.",
        ],
      },
      {
        heading: "Write the list from the plan, not the other way around",
        body: [
          "Once you have your four meals, check each one against what you already have and write down only the gaps. This is the shopping list.",
          "A list built from a plan is always shorter than a habitual list. You buy what you need; nothing goes in the bin unused.",
        ],
      },
      {
        heading: "Don't plan breakfast and lunch",
        body: [
          "Unless you have a specific reason to, don't add breakfast and lunch to your meal plan. Most people have a small set of things they rotate through for those meals without thinking about it. Planning them adds work without much benefit.",
          "Focus your planning energy on dinner, which is the meal where most of the decision fatigue and food waste happens.",
        ],
      },
      {
        heading: "Keep a running list of meals your household likes",
        body: [
          "The hardest part of meal planning isn't the logistics — it's deciding what to cook. A bank of 20–30 meals your household reliably enjoys makes this instant. Consult the list, pick four, done.",
          "Build the list slowly, adding to it whenever you cook something that went over well. After a few months you have a rotation with no decision fatigue.",
        ],
      },
      {
        heading: "Let the app do the boring parts",
        body: [
          "Checking what's in the fridge, tracking what's low, generating a shopping list from what you're missing — these are all mechanical tasks that take time but require no judgement. They're the right things to delegate to an app.",
          "The best meal planning tools work from your actual pantry contents, not from a generic template. They tell you what you can cook tonight with what you have, fill the gaps in a shopping list, and track what needs using up before it expires.",
        ],
      },
    ],
    ctaHeading: "Meal planning that starts from your fridge",
    ctaBody:
      "GroceryManager reads your pantry and suggests what to cook tonight based on what you already have. It plans your week, fills the gaps in your shopping list, and tracks what's about to expire — so planning takes minutes, not an hour on Sunday.",
  },
  {
    slug: "grocery-budget-tracker",
    title: "How to track your grocery spending (without a spreadsheet)",
    description:
      "Grocery spending is the easiest household cost to reduce — once you can see it clearly. Here's a practical approach.",
    publishedAt: "2026-06-15",
    readMinutes: 5,
    keywords: [
      "grocery budget",
      "grocery budget tracker",
      "track grocery spending",
      "grocery spend",
      "food budget",
    ],
    sections: [
      {
        heading: "Why grocery spending is hard to track",
        body: [
          "Unlike rent or a phone bill, grocery spending is fragmented. It happens in multiple places — supermarkets, local shops, online deliveries, takeaways — at irregular intervals. There's no single line on your bank statement that says 'food.'",
          "When people try to track it with a spreadsheet, they usually give up within a month. The effort of entering every purchase manually doesn't feel worth it.",
          "The more durable approach is to capture the data where it already exists — on your receipts.",
        ],
      },
      {
        heading: "Start with receipts, not guesses",
        body: [
          "A grocery receipt contains everything you need: the date, the store, every item, and the price. Photographing receipts takes two seconds. Importing them from your inbox (if you order online) takes no time at all.",
          "Once your receipts are in one place, the spending picture builds itself. You don't have to estimate how much you spent on meat last month — you can look it up.",
        ],
      },
      {
        heading: "Categories matter more than totals",
        body: [
          "Most grocery spending breakdowns are too coarse to act on. 'I spent £480 on food last month' doesn't tell you what to change. 'I spent £120 on meat, £80 on dairy, and £60 on ready meals' does.",
          "Category breakdowns reveal the patterns. Maybe your household spends more on convenience foods in the third week of the month when everyone's busy. Maybe fresh produce is wasted because you buy it on weekends but don't eat it by midweek. Patterns you can see, you can fix.",
        ],
      },
      {
        heading: "Set a realistic baseline, not an aspiration",
        body: [
          "Before you set a budget, track your spending for four to six weeks without trying to change it. This gives you your actual baseline — what you spend in the normal course of life.",
          "Most people underestimate their grocery spending by 20–30% when asked to guess before tracking. Starting from a realistic baseline means your budget is achievable rather than immediately discouraging.",
        ],
      },
      {
        heading: "Look at store vs home-cooked split",
        body: [
          "One of the most useful numbers to track is the ratio of home-cooked meals to bought meals (takeaways, deliveries, eating out). A single bought meal usually costs 3–5× as much as the equivalent home-cooked dish.",
          "If you track both sides — grocery receipts and restaurant/delivery spending — you can see the real cost of convenience and make an informed choice rather than an instinctive one.",
        ],
      },
      {
        heading: "Use the data to change one thing",
        body: [
          "The goal of tracking isn't to generate a report. It's to find one or two specific changes that reduce spending without making life worse.",
          "Common high-value changes: buying meat in larger pack sizes and portioning at home (30–40% cheaper per meal); switching two or three habitual ready meals to batch-cooked equivalents; doing a 'use what's there' week once a month before a big shop.",
          "One change at a time. Track whether it actually worked. Then try another.",
        ],
      },
    ],
    ctaHeading: "Spending insights built from your receipts",
    ctaBody:
      "GroceryManager imports your grocery receipts automatically — from photos or your Gmail inbox — and shows you where your food budget actually goes. Category breakdowns, weekly trends, and a year-end summary of your kitchen life. No spreadsheet required.",
  },
  {
    slug: "best-pantry-tracker-apps",
    title: "Pantry tracker apps: what actually works in 2026",
    description:
      "Most pantry tracker apps make you do the work. Here's what separates the ones that stick from the ones that get deleted after a week.",
    publishedAt: "2026-06-28",
    readMinutes: 6,
    keywords: [
      "pantry tracker app",
      "best pantry tracker",
      "pantry tracking app",
      "grocery tracker app",
      "food inventory app",
    ],
    sections: [
      {
        heading: "Why most pantry apps get abandoned",
        body: [
          "The pattern is familiar. You download a pantry tracker, spend 20 minutes entering everything in your fridge and cupboards, feel briefly organised, then forget about it entirely by next week.",
          "The problem isn't the app. It's the input model. Any system that requires you to manually add, update, or remove items every time you shop, cook, or throw something away is asking you to do work that most people won't sustain. The app becomes stale, then useless, then uninstalled.",
          "The pantry trackers that actually stick solve this problem differently: they get their data from sources that already exist — your receipts — rather than asking you to create new data from scratch.",
        ],
      },
      {
        heading: "The feature that matters most: automatic updates",
        body: [
          "The most important thing a pantry tracker can do is update itself without you thinking about it.",
          "Receipt import — either by photographing a paper receipt or connecting your email inbox to pull digital receipts automatically — is the feature that makes this possible. When you buy groceries, the transaction generates a receipt. If the app reads that receipt, your pantry is updated automatically. You didn't do anything; the data just flows in.",
          "The same principle applies in reverse: when you cook, logging a meal should subtract ingredients from your pantry in a single tap. When the maintenance burden drops low enough, people actually maintain it.",
        ],
      },
      {
        heading: "Static inventory vs. depletion awareness",
        body: [
          "Even apps that track purchases well often fail at the harder problem: knowing how much of something you have right now.",
          "Buying 400g of pasta is a fact. But how much of it did you use on Wednesday? A static inventory tracker doesn't know. It still shows 400g. After a few months of cooking, the app's numbers and your actual cupboard have nothing to do with each other.",
          "A better approach models depletion over time. If you typically use a 400g bag of pasta in two weeks, the app estimates you're down to about 200g after one week — without you manually updating it. Combined with real purchase data, this model stays accurate enough to be useful. It's the difference between knowing what you bought and knowing what you actually have.",
        ],
      },
      {
        heading: "Meal suggestions that start from your fridge",
        body: [
          "Recipe apps and pantry trackers are different things. A recipe app gives you meal ideas. A pantry-aware meal suggester tells you what you can cook tonight with what you already have — which is far more useful on a Tuesday evening.",
          "The ranking matters here. Showing you every recipe you have at least one ingredient for isn't useful. What's useful is surfacing the two or three meals you can make right now without buying anything, with items that are about to expire prioritised at the top.",
          "This feature — cook-from-pantry suggestions — is what turns a pantry tracker into a genuine kitchen tool rather than an inventory app you check occasionally.",
        ],
      },
      {
        heading: "What to look for",
        body: [
          "When evaluating a pantry tracker, the questions worth asking are practical: Does it update without manual entry? Does it model how fast items deplete? Does it connect the pantry to meal suggestions? Does it work when your phone is offline?",
          "Some apps ask you to link your bank account to pull transaction data. This works in theory, but adds a permissions step many people are uncomfortable with. Receipt-based import achieves the same result without needing financial access.",
          "The best pantry trackers also work across platforms — both as a web app you can access anywhere and as a native mobile app for daily habit. The daily check-in happens on your phone; the weekly planning session benefits from a larger screen.",
        ],
      },
      {
        heading: "The shopping list connection",
        body: [
          "A pantry tracker that doesn't connect to your shopping list is half the solution. The real value comes from the loop: you track what you have, the app notices what's running low, and it surfaces those items on a shopping list — before you run out.",
          "The best implementations do this automatically. They watch depletion rates, estimate when you'll hit zero, and add the item to your list at the right time — not when you've already run out, and not so far in advance that the reminder is useless.",
          "Combined with depletion modelling and receipt import, this loop means your shopping list builds itself: you buy, the app tracks, it runs low, it reorders. You're just the person who approves the list.",
        ],
      },
    ],
    ctaHeading: "A pantry tracker that updates itself",
    ctaBody:
      "GroceryManager tracks your pantry from receipts — photo or Gmail inbox — so you never have to enter items manually. It models depletion rates, suggests what to cook from what you have, and builds your shopping list automatically. Free to start.",
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
