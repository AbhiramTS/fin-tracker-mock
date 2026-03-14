# Business Requirements Document (BRD)

## 1. Document Purpose
This document defines the business need, goals, scope, users, and high-level success criteria for a personal finance management application.

## 2. Business Problem
Many users struggle to maintain a clear view of their day-to-day finances, future payment obligations, debt repayment schedules, and long-term financial goals. Existing tools often focus on past spending rather than future financial awareness, leaving users vulnerable to missed payments, cash shortfalls, and poor financial discipline.

## 3. Business Objective
The application will help users:
- Track daily expenses and income manually
- Monitor account balances and financial obligations
- Forecast future balances based on recurring and one-time events
- Receive alerts before they run short of money
- Track debts, money lent, and repayment progress
- Set and monitor financial goals
- Improve financial discipline through visibility and reminders

## 4. Vision Statement
A local-first, mobile-friendly personal finance command center that helps users understand where their money is, where it is going, and whether they will have enough for upcoming commitments.

## 5. Target Users
Primary users:
- Salaried individuals
- People managing multiple bank accounts
- Users with EMIs, loans, or credit card dues
- Users who prefer manual control over finances
- Users who want private, offline-capable finance tracking

Secondary users:
- People tracking money lent to others
- Users saving toward short-term and long-term goals
- Users who want a simple but powerful alternative to transaction-heavy finance apps

## 6. Business Goals
- Increase financial awareness for users
- Reduce missed EMI and credit card payments
- Help users avoid shortfalls before they occur
- Improve personal financial discipline
- Provide a reliable local-first experience with optional cloud sync
- Support future extensibility without forcing a vendor lock-in

## 7. Scope
### In Scope
- Manual entry of income, expenses, transfers, loans, credit card activity, and lent money
- Recurring income and recurring payments
- Forecasting future balances
- Alerts for shortfalls and upcoming obligations
- Financial goals tracking
- Account reconciliation
- Double-entry accounting foundation
- Graphs and visual summaries
- PWA experience and mobile-friendly usage
- Optional sync to a backend provider of the user’s choice
- QR-based device pairing for easy desktop-to-mobile syncing

### Out of Scope
- Mandatory bank account aggregation
- Automatic transaction scraping from banks in the initial phase
- Trading, taxation, or investment advisory services
- Real-time market data integrations as a core requirement
- Complex enterprise accounting workflows

## 8. Business Requirements
- The application must store financial data locally first.
- The application must work offline.
- The application must support optional sync to cloud storage.
- The application must allow the user to manage all financial data manually.
- The application must support forecasting of balances over future dates.
- The application must distinguish between normal loans and credit card-linked loans.
- The application must support full amortisation for all loans.
- The application must support double-entry accounting principles.
- The application must allow account reconciliation when tracked balances differ from real balances.
- The application must support goals with progress tracking.
- The application must be mobile-friendly and installable as a PWA.

## 9. Business Value
- Prevents missed payments and penalties
- Reduces financial stress through proactive forecasting
- Improves budgeting and spending discipline
- Helps users make better borrowing and spending decisions
- Builds trust through local-first storage and data ownership

## 10. Success Criteria
The product will be considered successful if:
- Users can consistently track income, expenses, obligations, and balances in one place
- Users can see future shortfalls before they happen
- Users can understand the impact of loans and payments before committing
- Users can reconcile accounts accurately
- Users can progress toward goals with measurable visibility
- Users prefer the app for daily financial checks and planning

## 11. Assumptions
- Users are willing to enter data manually.
- Users value privacy and offline access.
- Users may choose different sync providers later.
- The product will evolve in phases rather than all at once.

## 12. Stakeholders
- End users
- Product owner
- Design team
- Engineering team
- Future support/operations team

