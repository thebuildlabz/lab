# Week 4: Customer-Facing Dashboards + Profile

**Status:** NOT STARTED
**Priority:** Next up when resuming development

---

## Overview

You've built the **engine**. Now you need the **showroom** - make the gamification visible and build the **Customer Dashboard** so founders see their progress, referrals, and earnings.

This is the week where the platform becomes **sticky**.

---

## What You Have (Backend Complete)

- [x] Points system (api/lib/gamification.js)
- [x] Badges (10 badge types)
- [x] Streaks (daily tracking)
- [x] Referrals (tracking + conversions)
- [x] Leaderboard API (api/gamification/leaderboard.js)

---

## What You Need (Frontend)

- [ ] **Profile Page** - Show my points, badges, streak
- [ ] **Referral Dashboard** - Show my referrals, earnings, copy link
- [ ] **Leaderboard Page** - See top builders, top referrers
- [ ] **Badge Showcase** - Display earned badges
- [ ] **Navigation Updates** - Add links to new pages

---

## Part 1: Profile Page (src/pages/Profile.jsx)

Create a "Founder's Hub" showing:
- Total points
- Badges earned (with icons)
- Current streak
- Referral earnings
- Referral link with copy-to-clipboard

Key components:
- StatCard (icon, title, value)
- BadgeCard (emoji, name, description, earned date)
- Referral link section with copy button

---

## Part 2: Referral Dashboard (src/pages/Referrals.jsx)

Show:
- Stats grid: Total referrals, Completed, Pending, Total Earnings
- Table of all referrals with:
  - Email
  - Status (completed/pending)
  - Referral date
  - Earnings ($500 per completed)

---

## Part 3: Leaderboard Page (src/pages/Leaderboard.jsx)

Tabbed interface:
- **Top Points** - Users with most points
- **Top Referrers** - Most successful referrals
- **Most Builds** - Most deployed apps

Table with:
- Rank (medals for top 3)
- Builder email
- Score/count

---

## Part 4: Navigation Updates

Add to navigation:
- Profile link
- Referrals link
- Leaderboard link

---

## API Endpoints (Already Exist)

- GET /api/gamification/profile?email=X - User stats
- GET /api/gamification/leaderboard - Top users
- GET /api/gamification/badges - Badge definitions

---

## Deployment Checklist

- [ ] Create src/pages/Profile.jsx
- [ ] Create src/pages/Referrals.jsx
- [ ] Create src/pages/Leaderboard.jsx
- [ ] Update App.jsx with routes
- [ ] Update navigation component
- [ ] Test profile page (login required)
- [ ] Test referral copy-to-clipboard
- [ ] Test leaderboard sorting
- [ ] Deploy to Vercel

---

## Expected Impact

**Day 1:** First user finishes building -> sees badge -> shares referral link
**Day 7:** User with 7-day streak sees badge -> feels ownership
**Day 30:** Leaderboard shows top 50 builders -> network effect starts
**Month 2:** Referrals generating 30% of new intakes -> organic growth flywheel

---

## Notes

- Use existing API endpoints where possible
- Match existing styling (slate-800/900 backgrounds, teal-400 accents)
- This project uses React Router (not Next.js), so use React Router patterns
- Store user email in localStorage after intake submission

---

*Created: December 7, 2025*
