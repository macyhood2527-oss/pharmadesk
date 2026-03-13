# PharmaDesk Readiness Checklist

## Purpose
This file is the simple go/no-go checklist for deciding if PharmaDesk is ready for actual small-branch use.

## Current Readiness
For one small local pharmacy branch with 1 to 2 devices:
- usable for pilot/testing: `Yes`
- usable for careful small real-world use: `Almost`
- fully polished production-ready system: `Not yet`

The app is already strong enough for a controlled rollout if the items in `Should Fix Before Live Use` are completed and followed.

## Ready Now
- login works
- admin and cashier roles exist
- products can be created and updated
- stock can be received
- receiving creates/updates batches
- POS checkout works
- FIFO batch deduction works
- expired batches are blocked from sale
- partial returns work
- whole-sale void works
- stock adjustments work
- sales and reports are connected
- stock history / audit trail works
- backup export and restore exist
- duplicate logical batches are now protected better
- receiving reference numbers are now protected better

## Should Fix Before Live Use
- replace seeded demo passwords if demo users exist
- test the full LAN setup on both devices
- confirm backup export and restore using a real test backup
- make sure the pharmacy staff understand that restore replaces live data
- confirm exact startup steps on the actual machine
- verify printer behavior on the real cashier device
- test at least one full end-to-end workflow:
  - receive stock
  - sell it
  - return part of it
  - void a sale
  - review reports
  - review stock history

## Strongly Recommended Before Live Use
- keep a daily backup routine
- keep a second copy of backups outside the app folder
- document the main machine IP for the 2-device setup
- change admin password from default if seeded
- change cashier password from default if seeded
- decide who is allowed to use restore/import
- decide who is allowed to view reports and sales

## Nice To Improve Later
- stronger deployment/setup flow
- archive/edit safeguards for more records
- automated tests for checkout, returns, voids, and receiving
- more report filters
- barcode workflow
- cleaner deployment process for LAN usage

## Go / No-Go Decision Guide

### Go For Pilot
You can say `Go` if:
- both devices can open the app reliably
- checkout works on the cashier device
- receiving works
- reports update correctly
- backup export works
- restore was tested at least once on a safe copy/test setup

### No-Go For Live Use Yet
Do `Not Go` yet if:
- LAN connection is unstable
- backup/restore has not been tested
- staff still do not understand receiving vs batches
- printer behavior is still unreliable
- default seeded passwords are still being used casually

## Practical Owner Answer
If used in one branch only, with 1 cashier device and 1 monitoring device, PharmaDesk is close to usable for actual operations, but only if backup discipline, LAN setup, and user procedures are handled carefully. The system is not too heavy for that setup. The bigger risk is not record count; the bigger risk is poor backup habits, misconfiguration, or staff confusion about workflow.

## Minimum Real-Use Checklist
- [x] backend starts correctly
- [x] frontend starts correctly
- [x] both devices can access the app -- for now i can access it on two diff browsers
- [X] admin account password changed -- AFTER logging wrong credentials, the log in page goes to white, 
- [X] cashier account password changed
- [x] products exist
- [x] suppliers exist
- [X] receiving tested -- BUT i think we'll put here that if the cost is higher than the selling price, an warning would add that selling price should be > cost price, something, also the receiving should have a edit just in case they have encoded is wrong especially the cost price becaise i cant find where to edit it
- [X] POS checkout tested
- [X]] print tested
- [X] return tested
- [X] void tested
- [ x reports checked
- [X] stock history checked
- [X] backup exported
- [X] restore tested safely

## Suggested Final Status
Current recommendation:
- `Ready for pilot/demo branch use`: Yes
- `Ready for careful small real use`: Yes, after checklist completion
- `Ready for long-term fully trusted production use without more hardening`: No
