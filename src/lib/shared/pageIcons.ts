/** A sensible icon for a page from its name, for tab bars and menus with icons. */
const RULES: [RegExp, string][] = [
  [/\b(home|start|welcome|main|feed)\b/, "House"],
  [/\b(search|find)\b/, "Search"],
  [/\b(explore|discover|browse)\b/, "Compass"],
  [/\b(profile|account|me|my ?page)\b/, "UserRound"],
  [/\b(setting|settings|preferences)\b/, "Settings"],
  [/\b(cart|basket|bag|checkout)\b/, "ShoppingCart"],
  [/\b(shop|store|products?|menu)\b/, "Store"],
  [/\b(orders?|receipts?|purchases?)\b/, "Receipt"],
  [/\b(messages?|chat|inbox|contact)\b/, "MessageCircle"],
  [/\b(favou?rites?|saved|likes?|wishlist)\b/, "Heart"],
  [/\b(notifications?|alerts?|updates?|news)\b/, "Bell"],
  [/\b(calendar|events?|schedule|bookings?|reservations?)\b/, "Calendar"],
  [/\b(tasks?|todos?|to-dos?|checklist)\b/, "CircleCheck"],
  [/\b(stats|dashboard|reports?|insights?|progress)\b/, "ChartColumn"],
  [/\b(map|places?|locations?|near)\b/, "MapPin"],
  [/\b(people|team|members|friends|guests?|community)\b/, "Users"],
  [/\b(photos?|gallery|pictures?)\b/, "Image"],
  [/\b(music|songs?|playlists?)\b/, "Music"],
  [/\b(videos?|watch)\b/, "Play"],
  [/\b(workouts?|fitness|gym|training)\b/, "Dumbbell"],
  [/\b(wallet|money|budget|expenses?|payments?)\b/, "Wallet"],
  [/\b(rewards?|points|leaderboard)\b/, "Trophy"],
  [/\b(add|new|create|post)\b/, "CirclePlus"],
  [/\b(about|info|help|faq)\b/, "Info"],
  [/\b(blog|articles?|posts|stories|read)\b/, "BookOpen"],
];

export function guessPageIcon(name: string): string {
  const n = name.toLowerCase();
  for (const [re, icon] of RULES) if (re.test(n)) return icon;
  return "Circle";
}
