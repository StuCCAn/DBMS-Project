# CUECLUB — Cue Sports Club & Tournament Management System

A database-backed system designed to manage the day-to-day operations of a cue sports club, including table reservations, member credit (udhar), tournaments, player rankings, coaching assessments, and inventory.

**Course:** CS F212 — Database Systems  
**Institution:** BITS Pilani, Hyderabad Campus  
**Team:** Group 18  
**Submission:** Mid-Semester, 11 October 2026

## Overview

CueClub brings interconnected club operations into a relational database-backed application. It is designed to reduce booking conflicts, disputed member balances, lost tournament brackets, and unexpected inventory shortages by enforcing business rules and data integrity at the database level.

## Key Features

- **Table reservations:** Support for hourly and per-frame billing, with overlapping bookings rejected.
- **Member credit ledger:** Track booking charges, canteen charges, fines, and payments; enforce credit limits and prevent over-settlement.
- **Tournament management:** Tournament registration, unique seeding, knockout and league formats, match scheduling, frame-by-frame scores, and bracket progression.
- **Player rankings and reports:** Leaderboards, win streaks, head-to-head records, table utilization, and skill-related reports.
- **Coaching assessments:** Record player assessments across skill areas to support team selection and development.
- **Inventory management:** Track equipment, consumables, servicing history, and low-stock reorder flags.
- **Role-oriented workflows:** Support club managers, staff/scorers, club members, team members/captains, and casual players.

## Intended Users

| User | Intended capabilities |
|---|---|
| Club manager (admin) | Operational overview, inventory and servicing, credit limits, tournament scheduling, and dispute resolution |
| Staff / scorer | Reservations, billing, credit ledger entries, frame scores, and bracket advancement |
| Club member | Book tables, view outstanding balance and discount status, and track rankings and tournament history |
| Team member / captain | Team-selection tracking, skill assessments, and participation in tournaments |
| Casual player | Walk-in reservations paid upfront and table availability; no credit facility |

## Technology and Architecture

The project report describes a three-tier application architecture with the following planned components:

- **Database:** MySQL relational database
- **Backend:** Express REST API, JWT authentication, and MySQL connection pooling
- **Frontend:** React user interface
- **Database logic:** Constraints, triggers, views, common table expressions (CTEs), and a transactional stored procedure

> The report documents the proposed architecture and workflows. Update this section as implementation details and run instructions are finalized.

## Database Design

The relational design contains 11 relations:

1. `Users`
2. `Club_Member`
3. `Game_Tables`
4. `Reservations`
5. `Credit_Ledger`
6. `Tournaments`
7. `Tournament_Registrations`
8. `Matches`
9. `Match_Frames`
10. `Skill_Assessments`
11. `Inventory_Items`

The design uses primary and foreign keys, unique constraints, domain checks, and triggers to enforce integrity. It also documents normalization to BCNF where applicable.

### Important Integrity Rules

- A table cannot have overlapping active reservations.
- Only club members can use the credit facility; casual players must pay upfront.
- Member balances cannot exceed their credit limits, and payments cannot exceed outstanding balances.
- A player can register only once per tournament, and seeds are unique within a tournament.
- A match winner must be one of the two players, and frame scores cannot be tied.
- Match completion is designed to update frame records, winner, next-round bracket, and ranking points in a single transaction.
- Team roles require an active membership.
- Inventory is flagged for restocking when quantity falls below its reorder level.
- Historical records are retained by deactivating users instead of physically deleting them.

## Main Workflows

- **Match completion:** Record frame scores, determine the winner, advance the bracket, and update ranking points transactionally.
- **Leaderboard and reports:** Generate rankings, win streaks, head-to-head statistics, table-utilization reports, and skill reports.
- **Booking and credit:** Create reservations while validating time conflicts, payment rules, and credit limits.
- **Inventory and coaching:** Flag low-stock items, maintain servicing history, and record skill assessments for team selection.

## Team

| Member | Responsibility |
|---|---|
| Priyansh Thadhani | ER/EER modeling, relational mapping, schema definition, and BCNF normalization |
| Goru Nikhil | Trigger and constraint design, foreign-key cascading rules, and transactional match-completion procedure |
| Ananya Avunooru | Application architecture, Express REST API design, JWT authentication, and MySQL connection pooling |
| Manya Bhateja | Reporting and views, leaderboard queries, recursive CTE bracket queries, and synthetic data generation |
| Ujjwal Chandak | React frontend design, booking flow, credit-ledger viewer, and documentation |

## Project Scope

**Included:** Table reservations and billing, member credit tracking, tournament brackets and scoring, rankings and reports, coaching assessments, inventory, and servicing records.

**Out of scope:** Payment gateway integration, live streaming, multi-club franchises, and inter-club fixtures against outside players.

## Getting Started

Setup instructions will be added once the repository contains the implementation files and confirmed database configuration.

Before running the application, the repository should document:

1. Required software and versions.
2. How to create and configure the MySQL database.
3. How to load the schema, triggers, views, and stored procedures.
4. Required environment variables (provide a `.env.example`, never commit real credentials).
5. How to install backend and frontend dependencies.
6. How to start the backend and frontend.
7. How to run tests or verify the core workflows.

## Repository Status

This README summarizes the project scope and design from the mid-semester report. Replace this status section with the current implementation status as modules are completed.

---

*Developed by Group 18 for CS F212 — Database Systems, BITS Pilani, Hyderabad Campus.*
