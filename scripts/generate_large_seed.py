#!/usr/bin/env python3
"""
CueClub Volumetric Seed Generator
Generates ~550+ realistic rows for database/seed_volumetric.sql to demonstrate
scalability, query efficiency, and satisfy the 500+ record course rubric.

Additive data only (IDs 100+) preserving baseline database/seed.sql demo fixtures.
"""

import sys
import os
import datetime

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "database", "seed_volumetric.sql")

def generate():
    lines = []
    lines.append("-- CueClub: Volumetric & Scalability Dataset (500+ Records)")
    lines.append("-- Generated for CS F212 DBMS Course Project Evaluation")
    lines.append("-- Additive seed using IDs >= 100 to preserve baseline seed.sql demo data\n")
    lines.append("USE cueclub;\n")

    # 1. Users (60 users: 101 to 160. 35 Members, 25 Casuals)
    lines.append("-- -------------------------------------------------------------")
    lines.append("-- 1. Users (60 rows: IDs 101 to 160)")
    lines.append("-- -------------------------------------------------------------")
    users_sql = ["INSERT INTO Users (user_id, name, phone, email, joined_on, user_type, ranking_points, is_active, app_role, password_hash) VALUES"]
    user_rows = []
    pw = "$2a$10$O0N8cR8gW4W2XjGg4v7EeuIsqX6KjJq1L8I0fT3a0.47w0MvC8Dce" # cueclub_default
    
    first_names = ["Arjun", "Dev", "Karan", "Nikhil", "Rahul", "Varun", "Aditya", "Manish", "Siddharth", "Pranav",
                   "Riya", "Ananya", "Sneha", "Pooja", "Isha", "Neha", "Tanvi", "Kavya", "Diya", "Meera"]
    last_names = ["Sharma", "Verma", "Patel", "Reddy", "Gupta", "Rao", "Nair", "Iyer", "Chopra", "Malhotra",
                  "Joshi", "Bhat", "Mehta", "Kapoor", "Saxena", "Deshmukh", "Singhania", "Aggarwal", "Chawla", "Bansal"]

    for uid in range(101, 161):
        fn = first_names[(uid - 101) % len(first_names)]
        ln = last_names[(uid - 101) % len(last_names)]
        name = f"{fn} {ln}"
        phone = f"987654{uid:04d}"
        email = f"user{uid}@cueclub.demo"
        joined = f"2026-{(uid % 5) + 1:02d}-15"
        utype = "Member" if uid <= 135 else "Casual"
        role = "Member" if uid <= 135 else "Casual"
        pts = 1000 + ((uid * 17) % 600)
        user_rows.append(f"({uid}, '{name}', '{phone}', '{email}', '{joined}', '{utype}', {pts}, TRUE, '{role}', '{pw}')")
    
    users_sql.append(",\n".join(user_rows) + ";\n")
    lines.extend(users_sql)

    # 2. Club_Member (35 rows: IDs 101 to 135)
    lines.append("-- -------------------------------------------------------------")
    lines.append("-- 2. Club_Member (35 rows: IDs 101 to 135)")
    lines.append("-- -------------------------------------------------------------")
    cm_sql = ["INSERT INTO Club_Member (user_id, membership_no, plan, start_date, end_date, discount_pct, credit_limit, is_team_member, team_role, selection_status, handedness, is_individual_player, handicap, preferred_game, is_enthusiast, interest_type, wants_trial) VALUES"]
    cm_rows = []
    
    plans = ["Monthly", "Quarterly", "Annual"]
    games = ["Snooker", "English Billiards", "8-Ball Pool", "9-Ball Pool"]
    
    for uid in range(101, 136):
        mno = f"CC-VOL-{uid:03d}"
        plan = plans[uid % 3]
        disc = [10.00, 15.00, 20.00][uid % 3]
        limit = [1000.00, 1500.00, 2000.00][uid % 3]
        
        if uid <= 115:
            # Team + Individual
            cm_rows.append(f"({uid}, '{mno}', '{plan}', '2026-01-01', '2027-12-31', {disc:.2f}, {limit:.2f}, TRUE, 'Player', 'Selected', 'Right', TRUE, {(uid % 10) + 1}, 'Snooker', FALSE, NULL, NULL)")
        elif uid <= 125:
            # Individual + Enthusiast
            cm_rows.append(f"({uid}, '{mno}', '{plan}', '2026-01-01', '2027-12-31', {disc:.2f}, {limit:.2f}, FALSE, NULL, NULL, NULL, TRUE, {(uid % 8) + 2}, '{games[uid % 4]}', TRUE, 'Casual', FALSE)")
        else:
            # Enthusiast only
            cm_rows.append(f"({uid}, '{mno}', '{plan}', '2026-01-01', '2027-12-31', {disc:.2f}, {limit:.2f}, FALSE, NULL, NULL, NULL, FALSE, NULL, NULL, TRUE, 'Learner', TRUE)")
            
    cm_sql.append(",\n".join(cm_rows) + ";\n")
    lines.extend(cm_sql)

    # 3. Reservations (250 rows: IDs 101 to 350 across tables 1 to 6)
    lines.append("-- -------------------------------------------------------------")
    lines.append("-- 3. Reservations (250 rows: IDs 101 to 350)")
    lines.append("-- -------------------------------------------------------------")
    res_sql = ["INSERT INTO Reservations (reservation_id, user_id, table_id, start_time, end_time, billing_mode, frames_played, total_amount, payment_status) VALUES"]
    res_rows = []
    
    # 250 reservations across historical days in July-October 2026
    # Fixed non-overlapping daily slots on 6 tables:
    # Slot 1: 10:00 - 11:00
    # Slot 2: 12:00 - 13:00
    # Slot 3: 14:00 - 15:00
    # Slot 4: 16:00 - 17:00
    # Slot 5: 18:00 - 19:00
    # Slot 6: 20:00 - 21:00
    slots = [
        ("10:00:00", "11:00:00"),
        ("12:00:00", "13:00:00"),
        ("14:00:00", "15:00:00"),
        ("16:00:00", "17:00:00"),
        ("18:00:00", "19:00:00"),
        ("20:00:00", "21:00:00")
    ]
    
    base_date = datetime.date(2026, 6, 1)
    res_id = 101
    day_offset = 0
    while res_id <= 350:
        current_date = base_date + datetime.timedelta(days=day_offset)
        date_str = current_date.isoformat()
        day_offset += 1
        
        for tid in range(1, 7): # Tables 1 to 6
            slot_idx = (res_id + tid) % len(slots)
            st_time, end_time = slots[slot_idx]
            st = f"{date_str} {st_time}"
            et = f"{date_str} {end_time}"
            uid = 101 + (res_id % 60)
            status = "Paid" if (res_id % 7 != 0) else "Cancelled"
            tot = 200.00 if tid <= 4 else 150.00
            
            res_rows.append(f"({res_id}, {uid}, {tid}, '{st}', '{et}', 'Hourly', 0, {tot:.2f}, '{status}')")
            res_id += 1
            if res_id > 350:
                break
                
    res_sql.append(",\n".join(res_rows) + ";\n")
    lines.extend(res_sql)

    # 4. Credit_Ledger (80 rows: IDs 101 to 180 for members 101 to 135)
    lines.append("-- -------------------------------------------------------------")
    lines.append("-- 4. Credit_Ledger (80 rows: IDs 101 to 180)")
    lines.append("-- -------------------------------------------------------------")
    cl_sql = ["INSERT INTO Credit_Ledger (entry_id, user_id, reservation_id, entry_type, amount, entry_date, note) VALUES"]
    cl_rows = []
    
    # Pair of Canteen Charge (75.00) followed by Payment (50.00)
    # This guarantees no balance overruns and no overpayment trigger errors!
    eid = 101
    for i in range(40):
        uid = 101 + (i % 25)
        m = 7 + (i // 15)
        d = (i * 2 % 25) + 1
        # Charge
        cl_rows.append(f"({eid}, {uid}, NULL, 'Canteen charge', 75.00, '2026-{m:02d}-{d:02d} 14:00:00', 'Volumetric Canteen snack {eid}')")
        eid += 1
        # Payment
        cl_rows.append(f"({eid}, {uid}, NULL, 'Payment', 50.00, '2026-{m:02d}-{d+1:02d} 18:30:00', 'Volumetric Partial payment {eid}')")
        eid += 1
        
    cl_sql.append(",\n".join(cl_rows) + ";\n")
    lines.extend(cl_sql)

    # 5. Tournaments (4 rows: IDs 101 to 104)
    lines.append("-- -------------------------------------------------------------")
    lines.append("-- 5. Tournaments (4 rows: IDs 101 to 104)")
    lines.append("-- -------------------------------------------------------------")
    tour_sql = [
        "INSERT INTO Tournaments (tournament_id, title, game_type, format, start_date, entry_fee, status) VALUES",
        "(101, 'Monsoon Snooker Open 2026', 'Snooker', 'Knockout', '2026-07-10', 100.00, 'Completed'),",
        "(102, 'Hyderabad 8-Ball Championship', 'Pool', 'Knockout', '2026-08-15', 50.00, 'Completed'),",
        "(103, 'Autumn Billiards Classic', 'Billiards', 'League', '2026-09-20', 100.00, 'Completed'),",
        "(104, 'Winter Invitational 2026', 'Snooker', 'Knockout', '2026-10-25', 150.00, 'Completed');\n"
    ]
    lines.extend(tour_sql)

    # 6. Tournament_Registrations (32 rows: 8 players each in 4 tournaments)
    lines.append("-- -------------------------------------------------------------")
    lines.append("-- 6. Tournament_Registrations (32 rows: IDs 101 to 132)")
    lines.append("-- -------------------------------------------------------------")
    tr_sql = ["INSERT INTO Tournament_Registrations (registration_id, tournament_id, user_id, seed_number, fee_paid) VALUES"]
    tr_rows = []
    tournament_players = {}
    reg_id = 101
    for tid in [101, 102, 103, 104]:
        reg_players = []
        for seed in range(1, 9):
            uid = 101 + ((seed - 1) + (tid * 3)) % 30 # Member users
            reg_players.append(uid)
            tr_rows.append(f"({reg_id}, {tid}, {uid}, {seed}, TRUE)")
            reg_id += 1
        tournament_players[tid] = reg_players
    tr_sql.append(",\n".join(tr_rows) + ";\n")
    lines.extend(tr_sql)

    # 7. Matches (28 rows: IDs 101 to 128 for the 4 completed knockout brackets)
    lines.append("-- -------------------------------------------------------------")
    lines.append("-- 7. Matches (28 rows: IDs 101 to 128)")
    lines.append("-- -------------------------------------------------------------")
    m_sql = ["INSERT INTO Matches (match_id, tournament_id, round_number, player1_id, player2_id, winner_id, next_match_id, table_id, scheduled_time, status) VALUES"]
    m_rows = []
    
    mid = 101
    tour_dates = {
        101: "2026-07-11",
        102: "2026-08-16",
        103: "2026-09-21",
        104: "2026-10-26"
    }
    for tid in [101, 102, 103, 104]:
        # 7 matches per 8-player bracket:
        # Final: mid + 6
        final_id = mid + 6
        # Semis: mid + 4, mid + 5
        sf1_id = mid + 4
        sf2_id = mid + 5
        # QFs: mid, mid+1, mid+2, mid+3
        qf1 = mid
        qf2 = mid + 1
        qf3 = mid + 2
        qf4 = mid + 3
        
        reg_players = tournament_players[tid]
        m_date = tour_dates[tid]
        
        # QF1
        m_rows.append(f"({qf1}, {tid}, 1, {reg_players[0]}, {reg_players[1]}, {reg_players[0]}, {sf1_id}, 1, '{m_date} 10:00:00', 'Completed')")
        # QF2
        m_rows.append(f"({qf2}, {tid}, 1, {reg_players[2]}, {reg_players[3]}, {reg_players[2]}, {sf1_id}, 2, '{m_date} 10:00:00', 'Completed')")
        # QF3
        m_rows.append(f"({qf3}, {tid}, 1, {reg_players[4]}, {reg_players[5]}, {reg_players[4]}, {sf2_id}, 1, '{m_date} 12:00:00', 'Completed')")
        # QF4
        m_rows.append(f"({qf4}, {tid}, 1, {reg_players[6]}, {reg_players[7]}, {reg_players[6]}, {sf2_id}, 2, '{m_date} 12:00:00', 'Completed')")
        # SF1
        m_rows.append(f"({sf1_id}, {tid}, 2, {reg_players[0]}, {reg_players[2]}, {reg_players[0]}, {final_id}, 1, '{m_date} 15:00:00', 'Completed')")
        # SF2
        m_rows.append(f"({sf2_id}, {tid}, 2, {reg_players[4]}, {reg_players[6]}, {reg_players[4]}, {final_id}, 2, '{m_date} 15:00:00', 'Completed')")
        # Final
        m_rows.append(f"({final_id}, {tid}, 3, {reg_players[0]}, {reg_players[4]}, {reg_players[0]}, NULL, 1, '{m_date} 18:00:00', 'Completed')")
        mid += 7
        
    m_sql.append(",\n".join(m_rows) + ";\n")
    lines.extend(m_sql)

    # 8. Match_Frames (70 rows: across matches 101 to 128)
    lines.append("-- -------------------------------------------------------------")
    lines.append("-- 8. Match_Frames (70 rows: composite PK match_id, frame_number)")
    lines.append("-- -------------------------------------------------------------")
    mf_sql = ["INSERT INTO Match_Frames (match_id, frame_number, p1_score, p2_score, highest_break) VALUES"]
    mf_rows = []
    
    for match in range(101, 129):
        # 2 or 3 frames per match, no draws!
        mf_rows.append(f"({match}, 1, 68, 35, 42)")
        mf_rows.append(f"({match}, 2, 54, 71, 38)")
        if match % 2 == 1:
            mf_rows.append(f"({match}, 3, 77, 21, 55)")
            
    mf_sql.append(",\n".join(mf_rows) + ";\n")
    lines.extend(mf_sql)

    # 9. Skill_Assessments (50 rows: IDs 101 to 150)
    lines.append("-- -------------------------------------------------------------")
    lines.append("-- 9. Skill_Assessments (50 rows: IDs 101 to 150)")
    lines.append("-- -------------------------------------------------------------")
    sa_sql = ["INSERT INTO Skill_Assessments (assessment_id, player_id, assessed_by, skill_area, rating, notes, assessed_on) VALUES"]
    sa_rows = []
    skills = ["Long potting", "Safety play", "Break building", "Positional play", "Cue ball control", "Pressure handling"]
    
    for aid in range(101, 151):
        pid = 101 + (aid % 30)
        coach = 2 if aid % 2 == 0 else 1
        skill = skills[aid % len(skills)]
        rating = 6 + (aid % 5) # 6 to 10
        m = 7 + (aid % 4)
        d = (aid % 25) + 1
        sa_rows.append(f"({aid}, {pid}, {coach}, '{skill}', {rating}, 'Volumetric assessment #{aid} for player', '2026-{m:02d}-{d:02d}')")
        
    sa_sql.append(",\n".join(sa_rows) + ";\n")
    lines.extend(sa_sql)

    # 10. Inventory_Items (15 rows: IDs 101 to 115)
    lines.append("-- -------------------------------------------------------------")
    lines.append("-- 10. Inventory_Items (15 rows: IDs 101 to 115)")
    lines.append("-- -------------------------------------------------------------")
    inv_sql = ["INSERT INTO Inventory_Items (item_id, name, category, quantity, reorder_level, reorder_flag, table_id, condition_status, last_serviced_date, vendor_name) VALUES"]
    inv_rows = []
    cats = [("Tournament Snooker Balls Set", "Balls", 6, 2, 1, "Good", "Aramith Belgium"),
            ("Pro Ash Cue 57in", "Cues", 12, 4, None, "Good", "Peradon UK"),
            ("Taom V10 Chalk Box", "Chalk", 24, 6, None, "Good", "Taom Finland"),
            ("Strachan 6811 Club Cloth", "Cloth", 4, 2, 2, "Needs Service", "Strachan Stroud"),
            ("Spider Rest with Brass Head", "Rest", 5, 2, 3, "Good", "Riley England"),
            ("LED Canopy Lamp 300W", "Lighting", 3, 1, 4, "Good", "Lumatec Sports"),
            ("Bed Cloth Iron Thermostat", "Maintenance", 2, 1, None, "Good", "Dufferin"),
            ("Tournament Pool Balls 2.25in", "Balls", 8, 3, 5, "Good", "Cyclop Taiwan"),
            ("Maple Break Cue 19oz", "Cues", 6, 2, None, "Good", "Predator USA"),
            ("Triangle Chalk Green", "Chalk", 50, 15, None, "Good", "Tweeten Fiber Co"),
            ("Simonis 860 Tournament Blue", "Cloth", 3, 2, 6, "Good", "Iwan Simonis"),
            ("Cross Rest with Brass Head", "Rest", 4, 2, 1, "Good", "Riley England"),
            ("Cue Tip Clamp Tool", "Maintenance", 5, 2, None, "Good", "Kamui Japan"),
            ("Leather Cue Case 3/4", "Cues", 8, 3, None, "Good", "BCE Snooker"),
            ("Billiard Table Dust Cover", "Maintenance", 6, 2, None, "Good", "CueCraft")]
            
    for idx, item in enumerate(cats):
        iid = 101 + idx
        name, cat, qty, rlvl, tid, cond, vendor = item
        t_val = f"{tid}" if tid else "NULL"
        reorder = "TRUE" if qty <= rlvl else "FALSE"
        inv_rows.append(f"({iid}, '{name}', '{cat}', {qty}, {rlvl}, {reorder}, {t_val}, '{cond}', '2026-08-10', '{vendor}')")
        
    inv_sql.append(",\n".join(inv_rows) + ";\n")
    lines.extend(inv_sql)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Successfully generated {OUTPUT_FILE}")
    print("Total rows generated:")
    print("  Users: 60")
    print("  Club_Member: 35")
    print("  Reservations: 250")
    print("  Credit_Ledger: 80")
    print("  Tournaments: 4")
    print("  Tournament_Registrations: 32")
    print("  Matches: 28")
    print("  Match_Frames: 70")
    print("  Skill_Assessments: 50")
    print("  Inventory_Items: 15")
    print("  Total Volumetric Rows: 624 rows")
    print("  Combined with baseline demo seed (68 rows) = ~692 total database rows.")

if __name__ == "__main__":
    generate()
