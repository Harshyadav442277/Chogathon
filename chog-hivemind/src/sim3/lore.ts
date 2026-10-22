// Character lore: pre-written, case-by-case text that turns one Chog's NFT traits (eyes, mouth, head, accessory,
// tier, skin, background) and a few seeded picks into a personal profile. Deterministic by Chog id: the same Chog
// always has the same temperament, quirk, dream and childhood, so a life story reads as a person, not a template.
// {a} = name, {home} = home town, {job} = job name. They / their is used throughout (no assumptions).
import { hash } from "../sim/world";

export type Traits = Record<string, string | undefined>;

const pickBy = <T,>(list: readonly T[], tag: string, id: number): T => list[hash(`${tag}:${id}`) % list.length];
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

// ---- Temperament: [name, line] ---------------------------------------------------------------------------
export const TEMPERAMENT: [string, string][] = [
  ["Stubborn", "{a} never backs down once an idea has taken root, even when the idea is plainly wrong."],
  ["Cheerful", "{a} greets every dawn as if it were a surprise party thrown just for them."],
  ["Cautious", "{a} checks the road twice, the weather three times, and the exits always."],
  ["Reckless", "{a} treats plans as suggestions and danger as a rumour."],
  ["Gentle", "{a} apologises to furniture they bump into, and means it."],
  ["Proud", "{a} keeps a spotless collar and a longer memory for slights."],
  ["Curious", "{a} cannot pass a closed door, a strange noise or an unlabelled jar without investigating."],
  ["Lazy", "{a} has raised napping to a craft and will defend it in public debate."],
  ["Loyal", "{a} sticks to friends the way burrs stick to wool: stubbornly and for the long haul."],
  ["Sly", "{a} always seems to be standing near the exact spot where something valuable has just been misplaced."],
  ["Dramatic", "{a} narrates their own life aloud, with pauses, for an audience that is not there."],
  ["Stoic", "{a} reacts to dragons and to dinner in the same level voice."],
  ["Anxious", "{a} rehearses conversations in advance, and then forgets every line."],
  ["Boastful", "{a} has fought something enormous in every story, and the something grows each telling."],
  ["Dreamy", "{a} is often found staring at clouds and has been known to walk into doors while doing so."],
  ["Practical", "{a} carries rope, a spare button and a little salt, and has needed all three."],
  ["Mischievous", "{a} has never once been seen doing it, and has somehow always just done it."],
  ["Kind", "{a} saves the larger half of every meal for whoever looks hungriest."],
  ["Grumpy", "{a} complains about everything and then does it flawlessly."],
  ["Brave", "{a} is afraid of plenty of things, and goes anyway; that, they say, is the whole of it."],
  ["Honest", "{a} cannot tell a lie, which has cost them several friends and won them several more."],
  ["Competitive", "{a} turns walks, meals and naps into contests, and sulks nobly when losing."],
  ["Thrifty", "{a} counts coppers the way others count stars, with reverence."],
  ["Romantic", "{a} writes verses about weather, bread and the way light lies on a sword."],
  ["Wise", "{a} says little, and when they speak the room remembers why."],
  ["Restless", "{a} cannot sit through a sunset without drumming something."],
  ["Superstitious", "{a} knocks on wood, salts doorways and never whistles after dark."],
  ["Patient", "{a} can watch a kettle all day without once suspecting it of anything."],
  ["Showy", "{a} would polish a wooden spoon if it meant a better entrance."],
  ["Humble", "{a} deflects every compliment with a shrug and an offer of tea."],
];

export const QUIRK = [
  "hums off-key while working and swears they are not humming",
  "keeps a tiny notebook of every meal they have ever enjoyed",
  "refuses to step on the cracks between paving stones",
  "talks to their boots, and the boots seem to listen",
  "counts everything in threes, then goes back and counts again",
  "collects interesting pebbles and names them",
  "always says goodnight to the moon, even in daylight",
  "sneezes when told a lie",
  "wears one sock inside out for luck",
  "never starts a journey on an even-numbered day",
  "draws a small star on the back of every door they pass",
  "keeps a pet snail called Sir Reginald in a pocket",
  "tastes the air before stepping into any new room",
  "whistles the same four notes before a fight",
  "tucks a flower behind one ear, whatever the season",
  "salutes passing crows",
  "writes letters to people they have not met yet",
  "cannot resist tapping a barrel to hear if it is full",
  "keeps a spare, much better, hat just in case",
  "says 'noted' after every piece of advice and never follows it",
  "hides small snacks in all of their pockets and forgets where",
  "tells the weather by the ache in a left ear",
  "is convinced one particular cloud follows them about",
  "stirs their tea counter-clockwise, 'to unwind the day'",
  "sleeps with a lantern on, and denies it",
  "bows to every bridge before crossing",
  "gives all of their swords, spoons and shovels names",
  "makes a wish on every coin before spending it",
  "carries a very small flag and plants it on good days",
  "can never remember any name, so calls everyone 'friend' with great warmth",
  "hums lullabies to livestock and swears it improves the eggs",
  "reads the last page of any book first",
  "peels fruit in a single long ribbon and lays it down as a pattern",
  "leaves a coin on every windowsill they visit",
  "shakes hands with both hands, so nobody is left out",
  "talks in third person when nervous",
  "stops dead to listen whenever a bell rings, whatever they were doing",
  "never eats before offering the first bite to the nearest stranger",
  "rolls up sleeves exactly three times, no more, no less",
  "keeps a map of places they mean to visit, which is mostly blank",
];

export const DREAM = [
  "to open a tiny inn with one table and a very good stew",
  "to see the sea from the top of a tall ship",
  "to be remembered by a child they will never meet",
  "to learn a song that makes strangers weep",
  "to own a garden with a gate no one else can open",
  "to sleep through a whole winter without being woken",
  "to be the best at one single, small, ridiculous thing",
  "to find the grave of the first Chog",
  "to cook a feast for every Chog in Monadia",
  "to ride a dragon, politely, once",
  "to speak with a Constellation face to face",
  "to forge one perfect blade and then never touch a forge again",
  "to see every sunrise in every region",
  "to be the Hero, purely to say they did not mean to be",
  "to be left alone for a week with a good book",
  "to write a verse the bards will steal",
  "to find out what is at the bottom of the deepest dungeon",
  "to earn a title nobody has heard before",
  "to see a friend who left return home safe",
  "to mend a quarrel that is older than they are",
  "to see their name painted on a shop sign",
  "to be the person who is not afraid of the dark",
  "to climb the tallest peak in the Emberforge range with a flask of cocoa",
  "to build a bridge that outlives them",
  "to tell one person the truth and be believed",
  "to find a place in Monadia where nobody has ever been bored",
  "to win a single argument with a particular innkeeper",
  "to make one enemy laugh",
  "to be the first to read the last page of the world",
  "to feed every stray cat in the capital",
  "to keep a promise made a long time ago",
  "to grow a tree from a seed taken out of the Dreamveil Meadows",
  "to stand on the walls of a fortress and not be needed",
  "to learn how to whistle with two fingers",
  "to find a lost thing, any lost thing, and return it",
  "to see the aurora over the Unminted Wastes",
];

export const FEAR = [
  "deep water, however shallow",
  "being forgotten",
  "large crowds and quiet rooms in equal measure",
  "the sound of a particular kind of bell",
  "thunder, which they pretend is drumming",
  "spiders, with a respect close to awe",
  "being found out as ordinary",
  "having to give a speech",
  "the dark under stairs",
  "disappointing somebody they admire",
  "empty chairs at a long table",
  "that the stars are looking away",
  "geese",
  "mirrors at night",
  "being left behind on a road at dusk",
  "heights, but only when someone is watching",
  "the moment before a battle, and nothing else",
  "never being believed",
  "a certain song, hummed backwards",
  "losing a friend to a quarrel over something small",
  "cold hands, their own and others'",
  "fire in anything but a hearth",
  "silence after a joke",
  "cellars",
  "wet socks",
  "being the last to leave",
  "unfinished business",
  "tall figures in grey cloaks",
  "that they have already made the biggest mistake of their life",
  "meeting their own double in the dream-realm",
];

export const MOTTO = [
  "Eat first, fight second.",
  "Every road ends somewhere; pick one with soup.",
  "Better a late arrival than a loud one.",
  "If it is worth doing, it is worth doing twice.",
  "Nothing is lost until someone stops looking.",
  "Luck is just preparation in a good hat.",
  "A friend carries the heavier end.",
  "Never trust a quiet goose.",
  "A small light is still a light.",
  "Today is also a day.",
  "There is always one more step.",
  "No hurry; the world is round.",
  "A full pot, a full heart.",
  "Whatever happens, take notes.",
  "Fear is only a lantern held too close.",
  "Home is wherever the kettle is.",
  "Ask kindly and carry rope.",
  "The blade is the last word, not the first.",
  "Mind the step, and the sky.",
  "Laugh before the fight, rest after it.",
  "Even a mountain was once a pebble.",
  "Do the next honest thing.",
  "Keep your promises small and your word large.",
  "Be the weather you wish to see.",
  "If lost, sit; if found, walk.",
  "Leave every inn better than you found it.",
  "Brave is what scared does anyway.",
  "Mud washes. Words don't.",
  "A good stew forgives a bad day.",
  "Sleep is the cheapest magic.",
  "Dawn does not ask permission.",
  "Hands in work are hands out of trouble.",
  "Beware of anyone who never loses.",
  "Never turn down a free biscuit.",
  "What you carry, carry well.",
  "The map is a rumour; the road is the fact.",
  "Better the small joy today than the great one in a thousand tomorrows.",
  "A star saw that, so behave.",
  "Share the fire.",
  "Next time, with feeling.",
];

export const FOOD = [
  "honey cakes", "mushroom stew", "toasted chestnuts", "cold berry pie", "pickled plums", "fried river fish",
  "warm cheese bread", "spiced apple cider", "roasted turnips with salt", "smoked sausage rolls", "sweet cream buns",
  "mint tea", "noodles with too much pepper", "sticky rice dumplings", "dried figs", "salted nuts", "plain porridge, with pride",
  "fresh-picked peas", "cinnamon toast", "cocoa so thick it stands up", "lemon biscuits", "bacon on anything", "soft boiled eggs", "wild garlic soup",
];

export const HOBBY = [
  "whittling tiny animals", "stargazing with a notebook", "mending other people's coats", "racing snails",
  "juggling three things badly", "collecting rumours", "pressing flowers in heavy books", "composing limericks",
  "swapping riddles with strangers", "baking for the temple children", "bird-watching with strong opinions",
  "playing a rattly flute", "sketching every cat", "stacking stones that never fall", "counting clouds",
  "gossiping with the market stalls", "learning card tricks", "knitting scarves that are far too long", "fishing without bait, for the quiet",
  "reading old guild notices for fun", "teaching crows to say their name", "map-making", "brewing teas of dubious safety",
  "carving their initials into shy corners", "walking a different road home every night", "arm-wrestling anything",
  "keeping bees, quarrelsomely", "memorising tavern songs", "writing letters that never get answered", "painting fences in bright colours",
];

export const SECRET = [
  "has never actually been to the town they claim to come from",
  "can read, and pretends otherwise to hear what people say in front of them",
  "once gave away a stranger's whole fortune by mistake and has been quietly repaying it",
  "is far more frightened than anyone knows",
  "secretly writes the verses that a famous bard sings",
  "has a tiny, perfect sword hidden in a boot",
  "is afraid they cannot actually do what everyone expects of them",
  "has a sibling in the demon realm",
  "remembers, now and then, a life before the summoning",
  "once froze in a fight and has never told anyone",
  "buried something under the oldest tree in town",
  "keeps a letter they never sent folded in their hat",
  "has been to the Hollow at night, alone, on a dare, and heard something answer",
  "is saving every coin for something that is not for them",
  "dislikes the very job they are so good at",
  "has told one lie so many times that they now believe it",
  "once saw a Constellation blink",
  "never learned to swim and arranges every plan around it",
  "knows the real name of a Demon General, and cannot say why",
  "has quietly forgiven someone who never asked",
  "was once offered a place at the demon court and said no, politely",
  "sleeps with a lamp on, still",
  "can hear the bells even when they are frozen",
  "has never, in fact, finished a book",
  "owes a debt to an innkeeper in another region",
  "was once mistaken for the Hero and let the mistake stand for a day",
  "still has the first coin they ever earned",
  "believes, quietly, that the Demon King is lonely",
  "keeps a spare name for emergencies",
  "knows exactly how this season ends, or thinks they do",
];

export const TALENT = [
  "a gift for finding lost things", "a voice that makes strangers hush", "hands that never shake", "a nose for rain",
  "an uncanny sense of direction", "a memory for faces and debts", "perfect pitch, unwelcome at funerals", "a knack for calming horses",
  "the ability to sleep anywhere", "fast hands at cards, and at pockets, if so inclined", "a laugh that can stop a brawl",
  "a stomach that digests anything", "a gift for knots", "a sixth sense for trouble about one minute too late",
  "a knack for persuading cats", "an eye for a fair price", "a steady hand with a needle", "skill at skimming stones to the far shore",
  "a talent for arriving exactly when needed", "an instinct for the best seat in the house", "a gift for naming things properly",
  "the patience to untangle anything", "luck at dice, but only in small amounts", "an ear for lies",
];

// ---- Childhood / calling / turning point (3 beats of the "before the summoning" story) -----------------------
export const CHILDHOOD = [
  "{a} grew up in {home}, in a house so small that the cat had to be asked to leave before anyone could sit.",
  "{a} was born in {home} during a thunderstorm, and everyone agrees the thunder was jealous.",
  "In {home}, {a} was the child who asked why until the grown-ups started asking back.",
  "{a} spent a short, sticky childhood in {home} getting into the kind of trouble that is mostly cake.",
  "Nobody in {home} remembers when {a} first arrived; they simply woke up one day and {a} had always been there.",
  "{a} was raised by an aunt, a neighbour and most of {home}'s market, and got a bit of everything.",
  "As a child in {home}, {a} once climbed the town bell tower and refused to come down for a full day and night.",
  "{a} was the quietest in a loud family in {home}, and learned very early how to be heard without shouting.",
  "{a} was the youngest of far too many cousins in {home}, and learned to eat quickly and listen faster.",
  "Back in {home}, {a} worked after school at the bakery, the smithy and the inn, and was fired from all three for the same reason: daydreaming.",
  "{a} remembers {home} as a place of long summers and short tempers, mostly their own.",
  "{a} spent whole afternoons in {home} sorting buttons and telling each one a different story.",
  "In {home}, {a} had a best friend who is, somehow, still not on speaking terms with them.",
  "{a} arrived in {home} on the back of a cart, wrapped in a flag nobody recognised.",
  "{a} spent childhood winters in {home} by a stove, listening to the old ones tell of the Hush.",
  "In {home}, {a} learned to count on a market stall, and never again trusted a scale.",
  "{a} was a quiet, watchful child in {home}, forever behind a door and mostly hearing things.",
  "Even as a youngster in {home}, {a} kept a list: of promises, of debts, of what people had said they liked.",
  "{a} was raised on the edge of {home}, where the road runs out and the stories start.",
  "As a child {a} sang for coins outside the {home} inn, and was paid mostly in soup.",
  "{a} was once lost for three days in the fields around {home}, and came back with a cow and a theory.",
  "Growing up in {home}, {a} took everything apart to see how it worked, and sometimes put it back.",
  "{a} had a hard childhood in {home}, and a soft heart in spite of it.",
  "{a} remembers learning to swim in {home}, in the sense that they remember not swimming.",
  "As a child in {home}, {a} spent hours on a fence watching caravans go by and wondering where they were all headed.",
  "{a}'s earliest memory in {home} is the smell of bread, the sound of a bell and somebody calling their name.",
  "{a} was the child in {home} who looked after the others' pets, siblings and secrets.",
  "{a} was brought up on the odd lore of {home}: rhymes, warnings and a long list of things not to whistle at.",
  "{a} never quite fit in {home}, and made a home of that too.",
  "{a}'s childhood in {home} had one great rule: be back before the lamps.",
];

export const CALLING = [
  "Learning the work of {job} was an accident: a lost errand, a borrowed apron, a kind word, and suddenly {a} was good at it.",
  "{a} chose {job} after watching an old master do it with such calm that it looked like a kind of music.",
  "Nobody expected {a} to become {job}, least of all {a}, who had planned to be a bard.",
  "{a} came to the life of {job} by way of a bet, a flood and a very understanding teacher.",
  "{a} wanted to be a Hero. The guild suggested {job}, and {a} has never entirely forgiven them, or thanked them enough.",
  "The call of {job} found {a} late, in a quiet room, with a dull knife and a sudden clear idea.",
  "As {job}, {a} learned that the work is mostly patience and one good moment.",
  "{a} apprenticed under a very old Chog who taught only three rules of {job}, and made them all sound like jokes.",
  "{a} stumbled into the work of {job} when somebody else did not turn up, and stayed because they did not leave.",
  "{a} took up {job} in secret at first, practising at night behind the barn.",
  "As {job}, {a} learned to read people the way others read the weather.",
  "It took {a} three apprenticeships and one small fire to settle on the work of {job}.",
  "{a} inherited the trade of {job} from an uncle who never told anyone what it cost him.",
  "{a} was never the strongest, the swiftest or the cleverest, but as {job} they were, for some reason, the one people sought out.",
  "{a} learned {job} from a stern master who smiled exactly twice, and both times it was about {a}.",
  "As {job}, {a} found the first thing that made the world quiet inside.",
  "{a} did the work of {job} for years before anyone gave it a name, and a title came much later.",
  "{a} took the job of {job} in a hurry and has been making it fit ever since.",
  "Being {job} suited {a} like a second skin, once they stopped fighting it.",
  "{a} first picked up the tools of {job} at a funeral, and has been grateful to the dead for it.",
  "{a} had a gift for {job} that only showed itself in a crisis, which made for lively apprenticeships.",
  "{a}'s grandmother was {job}, and did not approve of {a}'s methods, and was frequently proven wrong.",
  "{a} proved so hopeless at everything else that {job} was a mercy to all concerned.",
  "In the end {a} became {job} because the roads they had hoped for were all closed, and this one was open.",
  "{a} learned the work of {job} watching through a window, and then walked in and asked for the broom.",
  "As {job}, {a} is the sort who does the work well and then quietly corrects everyone else's.",
  "{a} chose {job} on purpose, and then spent years being surprised at how right it was.",
  "The work of {job} came to {a} in dreams first, then at the bench, then at last in public.",
  "{a} was a late bloomer as {job}, and bloomed so loudly that the neighbours complained.",
  "{a} has always said that {job} is not a living but a way of paying attention.",
];

export const TURNING = [
  "The turning point came on a grey Tuesday, when {a} found a door in {home} that had not been there before, and opened it.",
  "Before the summoning, {a} had one great chance to leave {home}, and chose to stay; they still think about it.",
  "One winter, {a} gave away everything they owned, and found out what they could not give away.",
  "A stranger once told {a} a fortune in {home}. Only a small part has come true, and it was the least pleasant.",
  "Something changed after the night the lanterns went out in {home}. {a} will not talk about it.",
  "A promise made at a well in {home} still sits in {a}'s pocket like a stone.",
  "The last thing {a} remembers before the summoning is a lantern, a smell of snow and somebody humming.",
  "{a} had a quarrel with an old friend in {home} the evening before the world changed, and has not stopped rehearsing the apology.",
  "On the last day before the summoning, {a} finished something they had been putting off for years, and felt oddly lighter.",
  "It was a small kindness that changed {a}'s life: a bowl of soup handed over a fence in {home}, no questions.",
  "Not long before being summoned, {a} lost a friend, and has been slowly learning to carry it.",
  "A fall from a cart in {home} left {a} with a scar and a strange new sense of humour.",
  "{a} once saved a stranger's life in {home} and was never thanked, and does not mind.",
  "One quiet evening in {home}, {a} sat by the water and decided, simply, to be someone they could stand.",
  "{a} had a dream three nights running about a lantern at a crossroads, and woke on the fourth beneath it.",
  "The summoning found {a} mid-sentence, which is why they still start some sentences and trail off.",
  "A message arrived for {a} in {home} the morning of the summoning, unsigned: 'Go. Don't be afraid.' They went.",
  "{a} had been planning a long journey from {home} for years, and the summoning, rudely, made it shorter.",
  "A small thing happened in {home} the day before the summoning: {a} laughed for the first time in a month.",
  "There was a night in {home}, in the rain, when {a} decided to stop apologising for being themselves.",
  "A letter from an old teacher in {home} told {a}: 'You were always better than you thought.' They kept it.",
  "{a} ran, once, from something in {home} and is still running, but in a better direction now.",
  "The most important day of {a}'s life before Monadia was spent in a boat in {home}, doing nothing, with a friend.",
  "In {home}, {a} had a teacher who said they would amount to nothing. {a} is still working on proving otherwise, politely.",
  "A single bell rang in {home} on the night of the summoning; only {a} heard it.",
  "The turning point was a gift: a plain wooden spoon, from someone {a} cannot now remember.",
  "A great storm took half of {home}'s roofs a season before, and {a} learned they could climb.",
  "At a crossroads outside {home}, {a} chose the left road, and has never been sure about the right one.",
  "{a} learned, in {home}, that being needed is not the same as being loved, and has been working that out since.",
  "{a} had one great ambition in {home}, quietly achieved it, and found it did not matter; hence the search for another.",
];

// ---- NFT trait flavour: first matching rule wins ---------------------------------------------------------
const rules = (v: string | undefined, table: [RegExp, string][], fallback: string) => {
  const s = (v ?? "").toLowerCase();
  for (const [re, line] of table) if (re.test(s)) return line;
  return fallback;
};

const EYES: [RegExp, string][] = [
  [/laser/, "Their {v} eyes are the sort that make blacksmiths ask for a discount."],
  [/visor/, "Behind a {v} visor, {a} watches the world as though reading its fine print."],
  [/vr|3d|glass/, "Their {v} lenses give them a faint air of seeing things the rest of us will see next year."],
  [/crying|tear|teary/, "Their {v} eyes are always a little wet, and nobody has ever dared ask if that is sorrow or onions."],
  [/dead/, "Their {v} gaze unnerves strangers, though it belongs to the kindest Chog in the room."],
  [/heart/, "Their {v} eyes fall on friends and foes alike with the same startling fondness."],
  [/happy|xd|smirk/, "Their {v} look is so cheerful that tax collectors have been seen to hesitate."],
  [/angry|thug|viper/, "Their {v} stare has settled many an argument without a word."],
  [/tired/, "Their {v} look suggests they have been awake since before the Hush, and are not discussing it."],
  [/side/, "Their {v} glances make everyone feel they are being quietly judged, and mostly correctly."],
  [/clown/, "Their {v} eyes have a mischievous glitter that has talked them into and out of countless scrapes."],
  [/frog/, "Their {v} eyes, wide and slightly unblinking, bring to mind something deep and patient in a pond."],
  [/mog|retard/, "Their {v} eyes have a gleeful, chaotic shine that sensible Chogs steer around."],
  [/round|normal|base|flat|up/, "Their {v} eyes are plain and honest, the kind you trust with a spare key."],
];
const MOUTH: [RegExp, string][] = [
  [/normal|smile/, "A steady smile rests on their face, which is useful for diplomacy and annoying at funerals."],
  [/sad|worried/, "Their mouth tilts down at the corners, giving them the look of a tragic poem on legs."],
  [/drool/, "They drool a little when thinking hard, and think hard about food a great deal."],
  [/bubblegum/, "They blow a pink bubble during every important decision and make the choice when it pops."],
  [/rainbow/, "Their rainbow-flecked mouth leaves a trail of colour that children follow on market days."],
  [/gold tooth/, "A gold tooth glints whenever they grin, and they grin often, and not always honestly."],
  [/lip bite/, "They bite their lip when plotting, which is nearly always."],
  [/coin/, "A coin glints between their teeth; they claim to be testing it, and nobody has dared check."],
  [/clown/, "Their clown grin is painted wide enough for two, and hides at least one tragedy."],
  [/flat/, "Their flat, unreadable mouth makes poker, and honest gossip, impossible near them."],
  [/grit/, "They grit their teeth against the world and the world, so far, has had to give way."],
  [/^wo$/, "A rounded 'wo' of astonishment is the usual shape of their mouth, as if the world were new each morning."],
];
const HEAD: [RegExp, string][] = [
  [/crown/, "They wear a crown that fits oddly well, and which nobody has dared ask the history of."],
  [/wizard/, "Their wizard hat is tall, lopsided and far more impressive than any spell they know."],
  [/spartan|helmet/, "A helmet crowns them, scuffed in all the right places, and worn even to the dinner table."],
  [/horn|thorn/, "Small horns sprout from their head, which has led to some awkward moments in the market and a few in the dungeons."],
  [/headband/, "A knotted headband holds their hair, and a certain fierce attitude, in place."],
  [/durag|bandana/, "A neat head wrap keeps them looking sharp and ready, even in a storm."],
  [/wig|bob/, "Their hair is their pride, and the market has learned not to touch it."],
  [/wreath|seal|3rd eye|diamond/, "A faint, odd glow rests about their head, and stray dogs sit up to look at it."],
  [/banana/, "A banana tied to their head. Nobody has ever got an answer as to why, and everybody is afraid to ask again."],
  [/beanie/, "A snug beanie sits low on their brow, as though keeping their thoughts from escaping."],
  [/cap|plumber|robber|neet|hat/, "Their favourite {v} sits at an angle that has been described as 'confident' and as 'a warning'."],
  [/.*/, "Their head is bare, which in Monadia counts as either bravery or a poor sense of weather."],
];
const ACCESSORY: [RegExp, string][] = [
  [/fwog/, "A tiny Fwog rides along with them everywhere, and has been consulted on important matters."],
  [/coin/, "A lucky coin never leaves their fingers; they flip it over decisions and cheat only a little."],
  [/sb/, "A mysterious 'SB' badge is pinned to their coat, and every explanation they give is different."],
  [/cigar/, "A cold cigar is clamped between their teeth, and has not been lit once in all anyone knows."],
  [/green candle/, "They carry a green candle, cheerfully, and light it when things go well."],
  [/red candle/, "They carry a red candle, grimly, and light it when things do not."],
  [/heart/, "A small heart charm hangs from their neck, and they are noticeably soft with strays."],
  [/knife/, "A knife rides in their belt, used mostly for bread, and sometimes, with regret, for other things."],
  [/pepe/, "A small green Pepe figure sits on their shoulder, wise, mournful and always a little damp."],
];
const TIER: Record<string, string> = {
  Common: "Among the Chogs, {a} is of the common sort: the kind that holds the world together without ever being noticed for it.",
  Uncommon: "{a} is a little out of the ordinary: nobody can say how, but heads turn for a second look.",
  Rare: "{a} is Rare, and Monadia knows it: guild clerks lower their voices and innkeepers find a better table.",
  Epic: "{a} is Epic, in the old sense of the word: stories seem to find them, whether invited or not.",
  Legendary: "{a} is Legendary, and the stars lean a little closer whenever they are named.",
};
const SKIN: [RegExp, string][] = [
  [/metal/, "Their skin has a faint metallic sheen that rings softly when they are struck, which they discourage."],
  [/jade|green/, "Their jade-green skin is said to bring luck to anyone who shakes their hand, and bring a swift apology to anyone who comments on it."],
  [/multi/, "Their skin shifts through many colours across the day, and they are forever being mistaken for several different Chogs."],
  [/white|grey/, "Their pale, almost silvery skin gives them a ghostly air they have learned to use to excellent effect."],
  [/black/, "Their dark skin is lit by an easy smile that makes good use of the dusk."],
  [/purple|blue/, "Their blue-violet skin is an unusual shade in Monadia, and has been compared favourably to twilight."],
  [/red/, "Their red skin glows when they are embarrassed, which is often, and so they have mastered not being so."],
  [/yellow/, "Their warm yellow skin is sunshine's cousin, and cheers rooms the moment they walk in."],
  [/pink/, "Their pink skin blushes at praise and bristles at insults, and is notoriously bad at hiding either."],
];
const BACKGROUND = [
  "was born under a {v} sky, which the old ones call a good omen for travellers",
  "came into the world beneath a {v} dawn, and has always loved early mornings for it",
  "grew up beneath a {v} horizon, and still turns toward it when thinking",
  "first opened their eyes to a {v} light, and has liked the colour since",
];

const BASE: [RegExp, string][] = [
  [/skull/, "Their skull-like form marks them as someone who has already been through the worst once; a certain calm has come with it."],
  [/radioactive/, "A strange glow clings to them, enough to read by in the dark; the apothecaries ask to borrow it."],
  [/1:1/, "They are one of a kind, in the strictest sense, and no cart-maker, tailor or bard has been able to capture them."],
];

export type Profile = {
  temperament: string; temperamentLine: string; quirk: string; dream: string; fear: string; motto: string;
  food: string; hobby: string; secret: string; talent: string;
  look: string[];   // from the NFT traits
  origin: string[]; // childhood, calling, turning point
  traits: { name: string; value: string }[];
};

/** The trait line for a Chog's NFT (eyes, mouth, head, accessory, tier, skin, background, form). */
export function lookLines(a: string, t: Traits): string[] {
  const out: string[] = [];
  const v = (x?: string) => (x && x !== "undefined" ? x : "");
  const f = (s: string, val: string) => fill(s, { a, v: val });
  if (v(t.Tier)) out.push(f(TIER[v(t.Tier)] ?? TIER.Common, ""));
  if (v(t.Eyes)) out.push(f(rules(t.Eyes, EYES, "Their eyes are unremarkable, and remarkably kind."), v(t.Eyes).toLowerCase()));
  if (v(t.Mouth)) out.push(f(rules(t.Mouth, MOUTH, "Their mouth is mostly used for talking and for snacks."), v(t.Mouth).toLowerCase()));
  out.push(f(rules(t.Head ?? "", HEAD, "Their head is bare, which in Monadia counts as either bravery or a poor sense of weather."), v(t.Head)));
  if (v(t.Accessory)) out.push(f(rules(t.Accessory, ACCESSORY, ""), v(t.Accessory)));
  if (v(t.Skin)) out.push(f(rules(t.Skin, SKIN, ""), v(t.Skin)));
  if (v(t.Base) && /skull|radioactive|1:1/i.test(v(t.Base))) out.push(f(rules(t.Base, BASE, ""), v(t.Base)));
  return out.filter(Boolean);
}

export function buildProfile(id: number, a: string, t: Traits, home: string, job: string): Profile {
  const [tName, tLine] = pickBy(TEMPERAMENT, "temper", id);
  const vars = { a, home, job };
  const bgv = t.Background && t.Background !== "undefined" ? t.Background.toLowerCase() : "";
  const look = lookLines(a, t);
  if (bgv) look.push(fill(`{a} ${pickBy(BACKGROUND, "bg", id)}.`, { a, v: bgv }));
  const traits = ["Background", "Skin", "Eyes", "Mouth", "Head", "Accessory", "Tier"]
    .filter((k) => t[k] && t[k] !== "undefined").map((k) => ({ name: k, value: String(t[k]) }));
  return {
    temperament: tName, temperamentLine: fill(tLine, vars),
    quirk: pickBy(QUIRK, "quirk", id), dream: pickBy(DREAM, "dream", id), fear: pickBy(FEAR, "fear", id),
    motto: pickBy(MOTTO, "motto", id), food: pickBy(FOOD, "food", id), hobby: pickBy(HOBBY, "hobby", id),
    secret: pickBy(SECRET, "secret", id), talent: pickBy(TALENT, "talent", id),
    look,
    origin: [fill(pickBy(CHILDHOOD, "child", id), vars), fill(pickBy(CALLING, "call", id), vars), fill(pickBy(TURNING, "turn", id), vars)],
    traits,
  };
}
