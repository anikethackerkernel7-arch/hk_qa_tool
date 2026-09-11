/**
 * SECRET — paste into Apps Script as answer-key.gs. Never load from HTML.
 */
var ANSWER_KEY = {
  "weights": {
    "mcqAPerItem": 5,
    "mcqBPerItem": 10,
    "transcribeMax": 40,
    "guidelinesMcqPerItem": 1
  },
  "mcqA": {
    "clip_10": {
      "correctKey": "1",
      "correctAnswer": "[laughter] you lost me already well paul paul got it i didn't even hit the buzzer [bg] see uh man [laughter]"
    },
    "clip_11": {
      "correctKey": "1",
      "correctAnswer": "oh they might have changed it but 'cause i don't i like now i don't mind it but like when i was a kid it was like i it was just too sticky but"
    },
    "clip_12": {
      "correctKey": "1",
      "correctAnswer": "so do you think that phone feels the same way about it as you do do you think it's you know uh man i i'm on my last legs here or do you think it's still like oh it's it knows"
    },
    "clip_13": {
      "correctKey": "1",
      "correctAnswer": "oh yeah i think a lot of reason i think a lot of the reason people are together is 'cause you don't know the other person you're getting to know them constantly"
    }
  },
  "guidelinesMcq": {
    "g01": {
      "correctKey": "C",
      "correctAnswer": "No — never, at any stage; human ears only",
      "question": "May transcribers use speech-recognition or AI tools to help produce a first draft?",
      "section": "Section A — Golden Rules & General Practice"
    },
    "g02": {
      "correctKey": "B",
      "correctAnswer": "As words (\"twenty-five\")",
      "question": "How should numbers be written in the transcription box?",
      "section": "Section A — Golden Rules & General Practice"
    },
    "g03": {
      "correctKey": "B",
      "correctAnswer": "library, the correct dictionary spelling",
      "question": "A speaker mispronounces \"library\" as \"libary.\" What do you type?",
      "section": "Section A — Golden Rules & General Practice"
    },
    "g04": {
      "correctKey": "B",
      "correctAnswer": "jason mars",
      "question": "A speaker means to say \"Jason Mraz\" but actually says \"Jason Mars.\" What should you type?",
      "section": "Section A — Golden Rules & General Practice"
    },
    "g05": {
      "correctKey": "B",
      "correctAnswer": "Merriam-Webster",
      "question": "Which dictionary is the primary spelling reference for this project?",
      "section": "Section A — Golden Rules & General Practice"
    },
    "g06": {
      "correctKey": "C",
      "correctAnswer": "Only for British-specific words",
      "question": "When is the Cambridge Dictionary used?",
      "section": "Section A — Golden Rules & General Practice"
    },
    "g07": {
      "correctKey": "C",
      "correctAnswer": "Apostrophes, hyphens, and periods after spelled-out letters",
      "question": "In the transcription box, which punctuation marks are allowed?",
      "section": "Section A — Golden Rules & General Practice"
    },
    "g08": {
      "correctKey": "B",
      "correctAnswer": "Alphabetical order",
      "question": "When two or more tags apply at the same point in a clip, in what order should they be listed?",
      "section": "Section A — Golden Rules & General Practice"
    },
    "g09": {
      "correctKey": "B",
      "correctAnswer": "mm-hm = agreement, mm-mm = disagreement",
      "question": "\"mm-hm\" and \"mm-mm\" mean:",
      "section": "Section B — Sounds, Hesitations & Unclear Speech"
    },
    "g10": {
      "correctKey": "B",
      "correctAnswer": "For a hesitation sound that is NOT one of the fixed-spelling sounds (um, uh, hmm, etc.)",
      "question": "When is the [fp] label appropriate?",
      "section": "Section B — Sounds, Hesitations & Unclear Speech"
    },
    "g11": {
      "correctKey": "C",
      "correctAnswer": "Laughter",
      "question": "Which of these sounds does NOT get the [hn] label?",
      "section": "Section B — Sounds, Hesitations & Unclear Speech"
    },
    "g12": {
      "correctKey": "B",
      "correctAnswer": "Research it first before deciding it's unintelligible",
      "question": "If you can hear a word clearly but simply don't recognize it, what should you do?",
      "section": "Section B — Sounds, Hesitations & Unclear Speech"
    },
    "g13": {
      "correctKey": "B",
      "correctAnswer": "Normalize to one candidate and wrap it in {{ }}",
      "question": "A speaker clearly says a word that could be \"authentication\" or \"verification\" — genuinely ambiguous. How is this handled?",
      "section": "Section B — Sounds, Hesitations & Unclear Speech"
    },
    "g14": {
      "correctKey": "C",
      "correctAnswer": "(())",
      "question": "The entire clip is mumbled, unintelligible speech from the main speaker, with no reasonable guess possible. What do you type?",
      "section": "Section B — Sounds, Hesitations & Unclear Speech"
    },
    "g15": {
      "correctKey": "B",
      "correctAnswer": "<ct>",
      "question": "A clip contains four or more people speaking over each other, and none of it is intelligible. What do you type?",
      "section": "Section C — Multiple Speakers & Overlap"
    },
    "g16": {
      "correctKey": "A",
      "correctAnswer": "Background speech that cannot be attributed to an identified speaker",
      "question": "What is [bg] used for?",
      "section": "Section C — Multiple Speakers & Overlap"
    },
    "g17": {
      "correctKey": "B",
      "correctAnswer": "<ct> alone",
      "question": "Two speakers talk over each other for an entire clip, and the overlapping words are unintelligible throughout. What do you type?",
      "section": "Section C — Multiple Speakers & Overlap"
    },
    "g18": {
      "correctKey": "A",
      "correctAnswer": "Wrap the overlapping stretch in <ol> </ol>, tagging every voice inside it",
      "question": "How should two people talking at the same time be transcribed when you CAN understand both of them?",
      "section": "Section C — Multiple Speakers & Overlap"
    },
    "g19": {
      "correctKey": "B",
      "correctAnswer": "<ga>",
      "question": "A recording has skips and dropouts throughout, making the speech impossible to judge at any point. What do you type?",
      "section": "Section D — Technical Problems with the Recording"
    },
    "g20": {
      "correctKey": "A",
      "correctAnswer": "[artifact]",
      "question": "A short static burst or pop occurs in the middle of otherwise clear, understandable audio. What do you type at that point?",
      "section": "Section D — Technical Problems with the Recording"
    },
    "g21": {
      "correctKey": "A",
      "correctAnswer": "<na>",
      "question": "A clip is completely silent, with no audio signal at all. What do you type?",
      "section": "Section D — Technical Problems with the Recording"
    },
    "g22": {
      "correctKey": "B",
      "correctAnswer": "<ns>",
      "question": "A clip has sounds (like traffic or white noise) but no human speech at all. What do you type?",
      "section": "Section D — Technical Problems with the Recording"
    },
    "g23": {
      "correctKey": "C",
      "correctAnswer": "f. b. i.",
      "question": "How should the acronym \"FBI,\" spoken as individual letters, be transcribed?",
      "section": "Section E — Numbers, Names, Spelling & Standalone Tags"
    },
    "g24": {
      "correctKey": "B",
      "correctAnswer": "ok",
      "question": "How is the word \"okay\" always transcribed?",
      "section": "Section E — Numbers, Names, Spelling & Standalone Tags"
    },
    "g25": {
      "correctKey": "C",
      "correctAnswer": "As actually spoken — contracted or expanded",
      "question": "How should contractions generally be transcribed?",
      "section": "Section E — Numbers, Names, Spelling & Standalone Tags"
    },
    "g26": {
      "correctKey": "B",
      "correctAnswer": "<nt>",
      "question": "An entire clip is in a language you cannot identify at all, and it cannot be transcribed. What is the full transcription?",
      "section": "Section E — Numbers, Names, Spelling & Standalone Tags"
    },
    "g27": {
      "correctKey": "A",
      "correctAnswer": "Standalone tags are for clips with truly nothing to transcribe; a hard-but-partially-intelligible clip is still transcribed normally",
      "question": "What is the key difference between a \"standalone tag\" clip and a clip that is simply hard to transcribe?",
      "section": "Section E — Numbers, Names, Spelling & Standalone Tags"
    },
    "g31": {
      "correctKey": "A",
      "correctAnswer": "so what so what",
      "question": "The speaker says the phrase \"so what\" twice in a row, back to back: \"so what so what.\" What do you type?",
      "section": "Section F — Scenario: What Would You Type?"
    },
    "g32": {
      "correctKey": "B",
      "correctAnswer": "i i want to to go",
      "question": "The speaker stumbles: \"i i want to to go.\" What do you type?",
      "section": "Section F — Scenario: What Would You Type?"
    },
    "g33": {
      "correctKey": "A",
      "correctAnswer": "call sarah wait i mean stacy",
      "question": "The speaker completes both names, with no word actually cut off: \"call sarah wait i mean stacy.\" What do you type?",
      "section": "Section F — Scenario: What Would You Type?"
    },
    "g34": {
      "correctKey": "B",
      "correctAnswer": "turn on the tele-",
      "question": "The speaker begins a word and is cut off mid-way: \"turn on the tele-\" (and the clip ends there). What do you type?",
      "section": "Section F — Scenario: What Would You Type?"
    },
    "g35": {
      "correctKey": "C",
      "correctAnswer": "(())",
      "question": "The entire clip is mumbled, unintelligible speech — you cannot make out a single word after several tries and have no reasonable guess. What do you type?",
      "section": "Section F — Scenario: What Would You Type?"
    },
    "g36": {
      "correctKey": "A",
      "correctAnswer": "<na>",
      "question": "The clip has no audio signal at all — it is completely silent. What do you type?",
      "section": "Section F — Scenario: What Would You Type?"
    },
    "g37": {
      "correctKey": "B",
      "correctAnswer": "one hundred forty-two people",
      "question": "The speaker says a number aloud: \"there are one hundred forty-two people in the room.\" How is the number written?",
      "section": "Section F — Scenario: What Would You Type?"
    },
    "g38": {
      "correctKey": "A",
      "correctAnswer": "email me at john dot smith at gmail dot com",
      "question": "The speaker spells out an email address: \"email me at john dot smith at gmail dot com.\" What do you type?",
      "section": "Section F — Scenario: What Would You Type?"
    },
    "g39": {
      "correctKey": "C",
      "correctAnswer": "that's so funny [laughter] right",
      "question": "The speaker laughs partway through a sentence: \"that's so funny [speaker laughs here] right?\" How do you write this in the transcription box?",
      "section": "Section F — Scenario: What Would You Type?"
    },
    "g40": {
      "correctKey": "B",
      "correctAnswer": "Look it up in Part 2 of the guide first",
      "question": "When you're unsure how to handle something in a clip, what is the correct first step?",
      "section": "Section F — Scenario: What Would You Type?"
    }
  },
  "mcqB": {
    "clip_06": {
      "correct": "yeah th- they have but it doesn't i don't really i have you have you tried facebook's or have you even seen it for sale anywhere ok"
    },
    "clip_07": {
      "correct": "and stars stars that are com- or stars that uh things that turn into supernovas um"
    },
    "clip_08": {
      "correct": "no we touched on that a little bit it's yeah it's it's uh we we're not really sure at the moment we know there could be harm yeah we know there could be harm and we we we we [laughter] covered that pretty well"
    },
    "clip_09": {
      "correct": "trying more is to go greener or what not in a sense trying to reduce their carbon footprint they should take it more yeah i see that more responsibility for themselves"
    }
  },
  "transcribe": {
    "clip_14": {
      "gold": "hey so i was always fascinated by caves and like how they're able to form so i wanted to ask you how do caves form beneath the ground"
    },
    "clip_15": {
      "gold": "exactly and the way you pause before making a joke or plan around different holidays is a good example of understanding different cultures so this helps make everyday interactions smoother and being patient and keeping an open mind also helps avoid quick judgments and this is important for building better relationships at work and also in your personal life"
    },
    "clip_16": {
      "gold": "yeah th- these are certainly possible things that can happen and you are right uh backup batteries do not last forever and in places with frequent or long power cuts robots might need to switch in to a very basic safe mode that uses much less energy and only handles the most essential safety task so sometimes people select uh extra backup power resources like portable chargers or even small generators just"
    },
    "clip_17": {
      "gold": "well most of the time the planets and dust disks look very small next to their star so they show up as tiny dots or faint rings but the star itself looks like a bright spot even with powerful light telescopes observing so with those advanced tools these objects are millions or even billions of times dimmer than their star so they'll only show up right at the edge of where the bright light from the star is blocked"
    }
  },
  "clipOriginals": {
    "clip_01": "regional issues um so uh th- the when we go into these meetings y- y- you see the same people that are dealing with uh with uh issues throughout the middle east",
    "clip_02": "so glad to have you in the state of south carolina thank you it’s good to be here awesome [bg] um we have four in college and i’m going to grad school oh",
    "clip_03": "i haven't been in the dating world at all i've just been totally turned off i'm just like ugh mm-mm mm-mm yeah",
    "clip_04": "<s1> atlanta <s2> [hn] <s1> recently [artifact] after a very late flight to try and get here and there were no flights because there was a whole that whole uh [hn] air traffic control thing",
    "clip_05": "so my thing is if you know colleges and universities are publicly funded and it's a public institution then why do you have to pay extra",
    "clip_06": "yeah th- they have but it doesn't i don't really i have you have you tried facebook's or have you even seen it for sale anywhere ok",
    "clip_07": "and stars stars that are com- or stars that uh things that turn into supernovas um",
    "clip_08": "no we touched on that a little bit it's yeah it's it's uh we we're not really sure at the moment we know there could be harm yeah we know there could be harm and we we we we [laughter]  covered that pretty well",
    "clip_09": "trying more is to go greener or what not in a sense trying to reduce their carbon footprint they should take it more yeah i see that more responsibility for themselves",
    "clip_10": "[laughter] you lost me already well paul paul got it i didn't even hit the buzzer [bg] see uh man [laughter]",
    "clip_11": "oh they might have changed it but 'cause i don't i like now i don't mind it but like when i was a kid it was like i it was just too sticky but",
    "clip_12": "so do you think that phone feels the same way about it as you do do you think it's you know uh man i i'm on my last legs here or do you think it's still like oh it's it knows",
    "clip_13": "oh yeah  i think a lot of reason i think a lot of the reason people are together is 'cause you don't know the other person you're getting to know them constantly",
    "clip_14": "hey so i was always fascinated by caves and like how they're able to form so i wanted to ask you how do caves form beneath the ground",
    "clip_15": "exactly and the way you pause before making a joke or plan around different holidays is a good example of understanding different cultures so this helps make everyday interactions smoother and being patient and keeping an open mind also helps avoid quick judgments and this is important for building better relationships at work and also in your personal life",
    "clip_16": "yeah th- these are certainly possible things that can happen and you are right uh backup batteries do not last forever and in places with frequent or long power cuts robots might need to switch in to a very basic safe mode that uses much less energy and only handles the most essential safety task so sometimes people select uh extra backup power resources like portable chargers or even small generators just",
    "clip_17": "well most of the time the planets and dust disks look very small next to their star so they show up as tiny dots or faint rings but the star itself looks like a bright spot even with powerful light telescopes observing so with those advanced tools these objects are millions or even billions of times dimmer than their star so they'll only show up right at the edge of where the bright light from the star is blocked",
    "clip_18": "right well what you're describing that's common it happens a lot unfortunately so your brain is just having a harder time ignoring small little things that bug you really only when you're tired that on-edge feeling that you're talking about it actually comes from your body's stress system just being more active because it hasn't gotten the break that it needs from sleep",
    "clip_19": "well people picked bright easy-to-spot stars or constellations like the big dipper or orion because they could see them most of the year and these stars moved in ways that they could count on some groups chose stars that showed up during certain times of the year or night using things around them like hills or trees to help figure out where the stars would be in the sky over time",
    "clip_20": "well yeah so if for some reason the air inside of the balloon just gets too cool while they're up in the sky then the balloon will slowly start to lose some of its drift and its lift so it'll drift a little bit more down towards the ground now the pilot does keep an air- an eye on this and you know will add some more heat so that the balloon doesn't drop too quickly or you know you know dropping too much so they definitely look out for those types of things",
    "clip_21": "oh ok those are some good tips i really like the one where you said just keep a glass of water and drink it first thing i'll definitely be doing that and i appreciate you taking the time to explain the importance of practicing self-care and then also giving me some tips thanks",
    "clip_22": "hmm ok so you'll sometimes see polygraph results in police investigations however most courts in the us won't accept them as solid evidence because they aren't seen as like being fully reliable now some states allow them in court if both sides agree still they're usually just s- uh used as a tool during an investigation instead of something that decides what happens in a case",
    "clip_23": "hmm gotcha ok well you know this has been really awesome uh talking about all these things 'cause now i'm gonna try some i'm gonna try actually making my own mixture you know with the water soap and glycerin but i'm also gonna make another mixture with the water soap and corn syrup i'm gonna try making both of those mixtures and uh you know before i can get that nice giant wand tool i'll probably uh i'm just gonna have to use my hands uh to try and",
    "clip_24": "well yeah when you notice a small mistake talk about it with someone or you can write it down what caused it and what you'll try differently next time this helps you focus on solving the problem instead of feeling embarrassed and if you share these moments with your team even during casual check-ins",
    "clip_25": "oh that's good to know wow you have been really helpful thank you so much for answering my questions about wi-fi security the internet everything you have been really helpful thank you",
    "clip_26": "okay um i'm pulling up your account right now sorry about the wait so i see the charge from last month and uh yeah that does look like a duplicate [hn] i'll go ahead and issue that refund today",
    "clip_27": "oh wow is this is this me am i actually talking [laughter] this is incredible i mean i've had thoughts millions of them swirling around in here you know like a little mental tornado of brilliant observations and witty comebacks [laughter] but they were always just thoughts trapped i just can't believe it",
    "clip_28": "alright [hn] let me pull up the deck revenue's up eleven percent this quarter um better than we forecasted i'll send the slides right after this call",
    "clip_29": "<s1> so um i actually i actually have some news uh i might be be leaving the company <s2> [hn] wait what um are you are you serious right now that's that's huge",
    "clip_30": "<s1> okay um [hn] so uh i think we should probably push the launch date you know just to be safe [hn] i mean the testing team still has like a ton of bugs to fix <s2> [laughter] yeah uh no i totally get that but um marketing's already booked the campaign for next week so uh that's gonna be a tricky conversation you know",
    "clip_31": "<s1> alright so before we finalize the budget [hn] i want to walk through each department's numbers one more time um marketing's asking for a bit more this quarter and i think that's fair given the campaign results um better than we forecasted i'll send the slides right after this call <s2> [hn] yeah i saw that request um honestly i think we can approve most of it but let's trim it slightly since you know we're still waiting on q. three numbers to confirm",
    "clip_32": "<s1> oh my god wait is that is that you [laughter] i haven't i haven't seen you in like forever um what are you even doing in this part of town <s2> i know right um i just i just moved nearby actually like a couple months ago i've been meaning to to text you honestly my bad",
    "clip_33": "<na>",
    "clip_34": "<s1> honestly um i've been thinking about about switching careers like completely [laughter] which sounds crazy i know but but i'm just kind of burnt out <s2> no i i get that um a lot of people our age are are doing that actually like what what would you even wanna do instead if you don't mind me asking",
    "clip_35": "<s1> okay so um i really think we should just just book the flights already [laughter] like we've been talking about this for for weeks now <s2> yeah no i i agree um but but can we at least at least decide on the dates first [hn] like october or november <s1> honestly um either works for me uh i'm just just excited we're actually doing this finally after all that talk",
    "clip_36": "<s1> so uh did you guys hear hear that priya's priya's leaving the company apparently she got got a really good offer <s2> yeah uh i heard it's it's a whole different industry too um kind of a big jump honestly but but good for her",
    "clip_37": "<s1> oh wow hey hey [laughter] i did not did not expect to run into you two um together of all places <s2> i know right um we were just just grabbing coffee actually you should should totally join us if you're free <s3> yeah come on um it's been it's been forever honestly [hn] we have so much to to catch up on",
    "clip_38": "<s1> so uh did you see the new campaign the one for for the summer launch [laughter] honestly i think it's kind of kind of hit or miss <s2> yeah um i liked the visuals but but the copy felt a bit a bit generic you know like we've seen that before <s3> hmm uh i actually thought it worked um especially for for social [hn] but yeah the messaging could've been sharper",
    "clip_39": "<s1> honestly uh i still think think email marketing's kind of kind of dead um [hn] nobody reads that stuff anymore <s2> [laughter] no way um it's actually actually still one of the best [hn] best r. o. i. channels like by far <s3> yeah uh i'd agree with that um it's just just gotta be done right you know not spammy",
    "clip_40": "<s1> hey oh my god is that you [laughter] i did not did not expect to see you here <s2> oh hey um yeah [hn] long day honestly didn't even didn't even see you coming",
    "clip_41": "<s1> so um guess what i got the the promotion [laughter] i still can't believe it honestly <s2> what oh my god congratulations um [hn] that's amazing you totally totally deserve it",
    "clip_42": "<s1> hey um i just wanted to check in how are you you actually doing since since everything happened <s2> honestly um not great [hn] but but i think i'm starting to to feel a little more like myself again",
    "clip_43": "<s1> it's weird um thinking back to to where we were ten years ago honestly feels like a different life <s2> yeah um a lot's changed [hn] but but i think we turned out okay honestly better than i expected",
    "clip_44": "<s1> so um i've been thinking about about the job offer and i i think i want to take it <s2> okay um that's exciting honestly a little scary too but but i'm with you on this",
    "clip_45": "honestly um i don't really have anything planned this weekend [laughter] which sounds boring but but i kind of need it you know just some time to to catch up on sleep and maybe watch a movie or two",
    "clip_46": "so um i finally finished that book you recommended [hn] and honestly the ending kind of kind of wrecked me a little like i did not see that coming at all",
    "clip_47": "ugh can you believe how hot it's been lately um i literally can't even go outside without without sweating within like two minutes it's ridiculous",
    "clip_48": "okay so um have you started that new series yet [laughter] because i binged like six episodes last night and honestly i have zero regrets it's that good",
    "clip_49": "so um i tried this new pasta recipe last night and it actually turned out really well which honestly never happens for me so i'm pretty proud of myself",
    "clip_50": "ugh the traffic this morning was insane um [hn] took me like twice as long to get here honestly i almost just turned around and worked from home instead",
    "clip_52": "honestly um i don't i don't really have anything planned this weekend [laughter] which which sounds kind of boring but but i think i actually actually need it you know like work's been so hectic lately um and i just want some time to to catch up on sleep maybe watch a movie or two [hn] and just just not think about anything for a bit uh my friend did mention something about about brunch on sunday though so um maybe i'll do that if i'm not too lazy",
    "clip_54": "so um i finally finally finished that book you recommended [hn] and honestly the ending kind of kind of wrecked me a little like i did not did not see that coming at all um i actually had to put it down for a second [laughter] which sounds dramatic i know but but yeah i think it's it's one of the best things i've read this year honestly you should should read it again just to catch all the little details you probably missed",
    "clip_55": "so um i'm finally moving out of my old place next month [hn] and honestly the whole process has been way more stressful than i expected there's just so much stuff to pack and i keep finding random things i forgot i even owned [laughter] like genuinely no idea why i still have half of it my friends offered to help with the move though so that's um one less thing to worry about at least",
    "clip_56": "okay so i've been trying to teach myself photography lately and honestly it's harder than it looks like i thought it was just about pointing the camera and clicking but there's so much more to lighting and composition than i realized i've been watching a bunch of tutorials online um and slowly it's starting to click but i still have a long way to go honestly",
    "clip_57": "wait have you been to that new place near pharmacy i went yesterday and honestly their cold brew is really good better than the spot we usually go to the seating is a bit limited though so um [fp] i have wait for ten minutes just to grab the table but the coffee itself was honestly totally worth it",
    "clip_58": "[hn] hi um i am calling about my order from last week the tracking says it was delivered but i honestly never received anything [hn] i have already contacted support twice and i am starting to get a little frustrated could someone please check what's going on",
    "clip_59": "<s1> hey um did you get a chance to finish the login issue the client meetings starts an about twenty minutes <s2> almost i am just fixing one last bug give me [fp] maybe five more minutes and i'll push the update",
    "clip_60": "hi i'd like grilled chicken pasta please um could you make it a little less spicy oh and sparkling water instead of soda would be great [laughter] thanks",
    "clip_61": "<s1> [hn] i think we are completely lost <s2> [laughter] didn't google map say left <s1> it did until my phone died let's just ask someone before we walk another mile",
    "clip_62": "[hn] excuse me i am trying to find central station my g. p. s. completely stopped working could you tell me if i am walking in the right direction",
    "clip_63": "<s1> hey ryan did you finish the dashboard update yet the client meeting starts in about ten minutes and i'm getting a little nervous <s2> almost i'm fixing one last issue give me five minutes and i'll upload everything before the meeting starts",
    "clip_64": "<s1> [laughter] you actually made it i thought traffic was going to keep you for another hour <s2> not this time the line outside was longer than the drive i already ordered your favorite latte",
    "clip_65": "<s1> excuse me [bg] has boarding started for flight three two eight i noticed the gate changed again <s2> let me check yes boarding starts in about five minutes at gate b. fourteen you're still perfectly on time",
    "clip_66": "<s1> hey ryan have you had a chance to finish the payment dashboard the client review meeting starts in less than fifteen minutes and i'm hoping we can send everything before they join <s2> [laughter] almost there [hn] i finally tracked down the last bug give me another five minutes and i'll push the update so everyone can review it before the meeting",
    "clip_67": "<s1> i think we've been walking in circles for almost an hour now does anyone recognize this trail <s2> [hn] honestly i don't my phone doesn't have any signal either and the map stopped loading about ten minutes ago <s3> wait i think i hear people talking down the hill maybe we should head that way before it gets dark",
    "clip_68": "<s1> is everyone hiding don't make any noise she's almost here <s2> [laughter] relax the lights are off she won't suspect anything <s3> okay here she comes <s4> [laughter] surprise happy birthday",
    "clip_70": "<s1> [hn] hi i'm here to collect a prescription under the name emily johnson <s2> certainly give me just a moment while i check the system yes i've found it would you like me to explain how to take the medication",
    "clip_71": "<s1> hi everything smells amazing what's your most popular burger <s2> definitely our spicy barbecue burger [laughter] most people order it with loaded fries and a fresh lemonade",
    "clip_72": "[hn] hi i think i lost my wallet somewhere near the train station this afternoon it has my i. d. bank cards and driver's license inside i'm really hoping someone turned it in",
    "clip_73": "seriously we've been waiting here for almost thirty minutes already the bus hasn't moved at all and nobody has explained what's happening this is really frustrating",
    "clip_74": "<s1> this little puppy arrived just last week he's friendly playful and already loves meeting new people <s2> [laughter] he's adorable i think he's already decided that i'm taking him home",
    "clip_75": "<s1> welcome back everyone today we're talking about productivity habits that actually work <s2> [laughter] i have to admit i used to believe multitasking made me faster until i realized it was slowing me down",
    "clip_76": "<s1> i still can't decide between the white flowers and the pink ones <s2> both would look beautiful but the white flowers match your venue perfectly <s3> [laughter] honestly as long as you're smiling everything else will be perfect",
    "clip_77": "<s1> great job just two more repetitions keep your back straight and don't rush the movement <s2> [hn] wow that's definitely harder than it looked but i think i can finish the last two",
    "clip_78": "<s1> [hn] good morning i reviewed your reports and everything looks much better than last month <s2> [hn] that's such a relief [hn] i've been following the treatment exactly as you recommended",
    "clip_79": "[hn] excuse me i ordered this meal almost forty minutes ago and it's still not here [hn] i'm really disappointed because everyone else at the table has already finished eating",
    "clip_80": "[hn] good morning everyone today i'll be presenting my project on renewable energy and how it can reduce pollution in modern cities [hn] i hope you find the presentation interesting",
    "clip_81": "[hn] good evening heavy rain and strong winds are expected throughout the night please avoid unnecessary travel and stay indoors whenever possible stay safe everyone",
    "clip_82": "i think i've taken the wrong exit again [hn] the g. p. s. keeps recalculating the route and honestly i'm completely lost now [hn] hopefully i can find a gas station to ask for directions"
  }
};
