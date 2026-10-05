"""Demo data so a fresh install has some friends to play with (SEED_DEMO=1)."""

import json
from datetime import date, timedelta

from server import insert, v_date, v_interaction, v_memory, v_person, v_relationship


def _md(days_from_now, year):
    d = date.today() + timedelta(days=days_from_now)
    return f"{year}-{d.month:02d}-{d.day:02d}"


def _ago(days):
    return (date.today() - timedelta(days=days)).isoformat()


def seed_demo():
    people = [
        dict(name="Hana Takeda", nickname="Hana", pronouns="she/her", circle="friends",
             birthday=_md(9, 1996), how_met="Pottery class, spring 2021", checkin_days=21,
             favorite=True,
             avatar=dict(hair="#f4a7c4", style="long", eyes="sparkle", acc="flower", skin="#ffe3d3", bg="#ffe9f3"),
             notes="Laughs at her own jokes before the punchline. Always brings snacks."),
        dict(name="Ren Ishikawa", nickname="Ren", pronouns="he/him", circle="friends",
             birthday=_md(40, 1994), how_met="Hana's roommate", checkin_days=30,
             avatar=dict(hair="#3b3b58", style="spiky", eyes="happy", acc="glasses", skin="#f6d2b8", bg="#e6f0ff"),
             notes="Quiet at first, then won't stop talking about synthesizers."),
        dict(name="Mio Kobayashi", nickname="Mimi", pronouns="she/they", circle="family",
             birthday=_md(-20, 2001), how_met="Little sister!", checkin_days=7,
             favorite=True,
             avatar=dict(hair="#8e6cd8", style="twintails", eyes="wink", acc="catears", skin="#ffe7d6", bg="#efe6ff"),
             notes="Studying marine biology. Will send you 40 octopus videos a day."),
        dict(name="Sora Mendes", nickname="", pronouns="they/them", circle="work",
             birthday="", how_met="Joined the team last year", checkin_days=45,
             avatar=dict(hair="#6cc3b5", style="bob", eyes="sleepy", acc="none", skin="#d9a982", bg="#e3f7f2"),
             notes="Coffee: oat flat white, extra hot."),
        dict(name="Grandma Yuki", nickname="Baachan", pronouns="she/her", circle="family",
             birthday=_md(70, 1948), how_met="", checkin_days=14,
             avatar=dict(hair="#d9d9e3", style="bun", eyes="happy", acc="glasses", skin="#f3d5c0", bg="#fff4dc"),
             notes="Calls every Sunday unless the garden needs her."),
    ]
    ids = []
    for p in people:
        p["avatar"] = json.dumps(p["avatar"])
        ids.append(insert("people", v_person(p))["id"])
    hana, ren, mio, sora, yuki = ids

    mems = [
        (hana, "interest", "Learning to make matcha properly — got a chasen for her birthday last year", "open"),
        (hana, "problem", "Landlord won't fix the heating; she's been dealing with it for weeks", "open"),
        (hana, "gift", "Ghibli museum tickets", "open"),
        (hana, "like", "Strawberry daifuku > everything", "open"),
        (hana, "dislike", "Cilantro. Do not.", "open"),
        (ren, "interest", "Building a modular synth, currently obsessed with filters", "open"),
        (ren, "goal", "Wants to play a live set before the end of the year", "open"),
        (ren, "gift", "Vintage Casio keyboard from the flea market", "open"),
        (mio, "problem", "Stressed about her thesis defense", "open"),
        (mio, "interest", "Octopuses. All of them.", "open"),
        (mio, "gift", "Plush octopus (the reversible mood one)", "given"),
        (sora, "like", "Bouldering on Thursdays", "open"),
        (sora, "problem", "Looking for a new apartment closer to the office", "resolved"),
        (yuki, "interest", "Growing tomatoes and gossiping about the neighbours", "open"),
        (yuki, "gift", "Large-print crossword book", "open"),
    ]
    for pid, kind, text, status in mems:
        vals = v_memory(dict(kind=kind, text=text, status=status))
        vals["person_id"] = pid
        insert("memories", vals)

    dates = [
        (hana, "Friendship anniversary", _md(25, 2021), True),
        (mio, "Thesis defense", (date.today() + timedelta(days=12)).isoformat(), False),
        (ren, "Live set at Kissa Neko", (date.today() + timedelta(days=33)).isoformat(), False),
    ]
    for pid, label, d, yearly in dates:
        vals = v_date(dict(label=label, date=d, yearly=yearly))
        vals["person_id"] = pid
        insert("dates", vals)

    talks = [
        (hana, _ago(3), "meet", "Tea at the new café; her heating saga; matcha whisking technique", "✨", "Ask if the landlord finally replied"),
        (ren, _ago(41), "text", "Synth filters, his cat Mochi learning to open doors", "😊", ""),
        (mio, _ago(2), "call", "Thesis nerves, octopus camouflage paper", "🥺", "Send good-luck message the morning of her defense"),
        (sora, _ago(60), "chat", "Bouldering grades, apartment hunting", "😊", ""),
        (yuki, _ago(9), "call", "Tomatoes are finally red; neighbour's new dog", "🥰", "Visit before autumn"),
    ]
    for pid, d, mode, topics, mood, fu in talks:
        vals = v_interaction(dict(date=d, mode=mode, topics=topics, mood=mood, follow_up=fu))
        vals["person_id"] = pid
        insert("interactions", vals)

    rels = [
        (hana, ren, "roommate"), (hana, mio, "best_friend"),
        (yuki, mio, "grandparent"), (sora, ren, "coworker"),
    ]
    for a, b, kind in rels:
        insert("relationships", v_relationship(dict(a_id=a, b_id=b, kind=kind)))
