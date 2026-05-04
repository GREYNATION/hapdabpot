/**
 * GildedScripts.ts
 * Official scripts for Gilded Claws Season 1.
 * Source: GILDED_CLAWS_Series_Bible_Scripts_1.md
 */

export interface GildedScript {
  id: string;
  title: string;
  scenes: {
    location: string;
    description: string;
    characters: string[];
    dialogue: { character: string; line: string; emotion: string }[];
  }[];
}

export const GILDED_SCRIPTS: Record<string, GildedScript> = {
  "S01E01": {
    id: "S01E01",
    title: "The Deal",
    scenes: [
      {
        location: "Dimly lit office",
        description: "Luna sits across from a shadowed figure. High contrast, cinematic lighting.",
        characters: ["Luna Vale", "Mysterious Client"],
        dialogue: [
          { character: "Luna Vale", line: "My father owed the Blackmanes everything. His business. His house. His dignity.", emotion: "resolute but sad" },
          { character: "Mysterious Client", line: "Get close to Roman Blackmane. Make him trust you. Then... help us take what's ours.", emotion: "manipulative" },
          { character: "Luna Vale", line: "And my father's debt?", emotion: "desperate" },
          { character: "Mysterious Client", line: "Erased. Every penny.", emotion: "cold" }
        ]
      },
      {
        location: "Office",
        description: "Luna stares at the contract, then picks up the pen and signs it.",
        characters: ["Luna Vale"],
        dialogue: [
          { character: "Luna Vale", line: "I told myself it was just a job. I didn't know he would change everything.", emotion: "haunted" }
        ]
      }
    ]
  },
  "S01E02": {
    id: "S01E02",
    title: "The Invitation",
    scenes: [
      {
        location: "Luna's tiny apartment",
        description: "Luna opens a gold-embossed envelope. She looks surprised.",
        characters: ["Luna Vale"],
        dialogue: [
          { character: "Luna Vale", line: "The Blackmane Foundation Gala. The most exclusive event in Elitewood. And somehow... I had a seat at the table.", emotion: "wonder" }
        ]
      },
      {
        location: "Bedroom",
        description: "Luna slips into an elegant borrowed gown, staring at herself in the mirror.",
        characters: ["Luna Vale"],
        dialogue: [
          { character: "Luna Vale", line: "You are not a fox from the south side. Tonight, you are whoever they need you to be.", emotion: "determined" }
        ]
      }
    ]
  },
  "S01E03": {
    id: "S01E03",
    title: "First Contact",
    scenes: [
      {
        location: "The Gala",
        description: "Chandeliers, animal elites in designer clothes. Luna navigates the crowd.",
        characters: ["Luna Vale", "Roman Blackmane"],
        dialogue: [
          { character: "Luna Vale", line: "I'd studied Roman Blackmane for weeks. His habits. His coldness. His schedule.", emotion: "focused" }
        ]
      },
      {
        location: "Gala Floor",
        description: "Luna bumps into Roman. Champagne spills.",
        characters: ["Luna Vale", "Roman Blackmane"],
        dialogue: [
          { character: "Roman Blackmane", line: "Watch where you're going.", emotion: "cold" },
          { character: "Luna Vale", line: "You might want to say that to yourself. You walked into me.", emotion: "bold" },
          { character: "Roman Blackmane", line: "You're new here.", emotion: "intrigued" },
          { character: "Luna Vale", line: "Is that a question or a warning?", emotion: "sharp" }
        ]
      }
    ]
  },
  "S01E07": {
    id: "S01E07",
    title: "Victor Appears",
    scenes: [
      {
        location: "Private Elevator",
        description: "Victor Blackmane steps in beside Luna. He has a wide, unsettling smile.",
        characters: ["Luna Vale", "Victor Blackmane"],
        dialogue: [
          { character: "Victor Blackmane", line: "You must be the new girl my nephew hired.", emotion: "sinister" },
          { character: "Luna Vale", line: "Luna Vale.", emotion: "guarded" },
          { character: "Victor Blackmane", line: "You're exactly what I was hoping for.", emotion: "darkly pleased" },
          { character: "Victor Blackmane", line: "Remember our deal, little fox. The clock is ticking.", emotion: "threatening" }
        ]
      }
    ]
  },
  "S01E31": {
    id: "S01E31",
    title: "Victor's Celebration",
    scenes: [
      {
        location: "Luxury Club",
        description: "Victor at his club, laughing unhinged.",
        characters: ["Victor Blackmane"],
        dialogue: [
          { character: "Victor Blackmane", line: "Give it back! Give it back! Hahaha! The Blackmane seat — give it back! It's mine!", emotion: "insane" }
        ]
      }
    ]
  }
};
