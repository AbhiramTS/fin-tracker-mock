# Product Requirements Document (PRD)

## 1. Product Name
Personal Finance Control Center

## 2. Product Overview
This product is a local-first, mobile-friendly personal finance application designed to help users track money, forecast future balances, manage obligations, model debt, monitor goals, and improve financial discipline.

## 3. Product Vision
The app should make it easy for users to answer the most important financial questions quickly:
- How much money do I have?
- How much can I safely spend?
- What payments are coming soon?
- Will I run short of money?
- Am I progressing toward my goals?

## 4. Product Principles
- Local-first storage
- Manual control of user data
- Offline-capable by default
- Optional cloud sync
- Mobile-first UX
- Clear financial forecasting
- Double-entry accounting foundation
- Simple user experience on top of a robust ledger model

## 5. Target Audience
- Salaried users
- Users with recurring EMIs
- Credit card users
- Users managing multiple accounts
- Users who want to track money lent to others
- Users saving for near-term and long-term goals
- Users who prefer privacy and local ownership of data

## 6. Problem Statement
Existing finance apps often focus on recording transactions after they occur. Users still struggle to understand future balance impact, payment obligations, loan burden, and whether they will have enough money in the coming days.

## 7. Product Goals
- Provide a clear daily financial status view
- Predict account balances into the future
- Warn users before shortfalls occur
- Support all important personal finance categories
- Make debt and loan impact visible before commitment
- Help users stay disciplined and goal-oriented

## 8. Key Features

### 8.1 Manual Finance Tracking
Users can manually add and manage:
- Income
- Expenses
- Transfers
- Recurring income
- Recurring payments
- Loans
- Credit card dues
- Credit card EMIs
- Money lent to others
- Financial goals

### 8.2 Account Management
Users can manage multiple account types, including:
- Bank accounts
- Cash wallets
- Credit cards
- Loan liabilities
- Receivables for money lent
- Investment accounts

### 8.3 Balance Forecasting
The system projects future balances using all known financial events. The forecast should show:
- Daily or date-based projected balances
- Expected dates of low balance or shortfall
- Upcoming income and outgoing obligations
- Impact of recurring commitments

### 8.4 Alerts and Warnings
The system should alert users about:
- EMI due dates
- Credit card due dates
- Upcoming recurring payments
- Projected shortfalls
- Goal deadlines or progress lag

### 8.5 Loan Modeling
The system should support both:
- Normal loans
- Credit card-linked loans

For each loan, the app should generate a full amortisation schedule and show:
- Principal outstanding
- Interest component
- EMI schedule
- Repayment timeline
- Final completion date

Credit card-linked loans should be tracked separately from normal loans and reflected in credit card billing.

### 8.6 Money Lent Tracking
Users should be able to track money lent to people or entities as receivables, including:
- Person/entity name
- Amount lent
- Amount repaid
- Outstanding amount
- Optional expected repayment date

### 8.7 Account Reconciliation
Users should be able to compare the tracked balance against the actual account balance and reconcile any difference. The app should support:
- Identifying the difference
- Adding a missing transaction
- Creating a reconciliation adjustment
- Maintaining an audit trail of adjustments

### 8.8 Financial Goals
Users should be able to create and track goals such as:
- Emergency fund
- House down payment
- Vacation fund
- Car purchase
- Debt payoff goal
- Retirement savings

The system should show:
- Current progress
- Target amount
- Target date
- Expected completion estimate
- Contribution progress

### 8.9 Visual Insights
The app should show charts and graphs for:
- Balance over time
- Expense categories
- Net worth trend
- Goal progress
- Debt burden
- Cash flow forecast

### 8.10 Simulation / Impact Preview
Before a user commits to a financial action, the app should show the likely impact of:
- Taking a loan
- Adding a recurring payment
- Making a large purchase
- Increasing debt burden
- Adding a goal contribution

## 9. User Experience Requirements
- The app must be easy to use on a phone.
- The app must support quick daily checks.
- The home screen must surface the most important financial status information first.
- The app must keep entry flows short and understandable.
- The app must present complex finance data in a simple way.

## 10. Data and Sync Principles
- User data must be stored locally first.
- The app must work without cloud access.
- Cloud sync must be optional.
- The user should be able to connect to a backend of their choice later.
- The app should support QR-based desktop-to-mobile syncing.

## 11. Platform Requirements
- Progressive Web App support
- Mobile-friendly responsive layout
- Desktop usability as well
- Offline access to key functions
- Installable experience

## 12. Success Metrics
The product is successful if users:
- Open it frequently to check financial safety
- Trust its balance forecasts
- Avoid missed EMI or credit card payments
- Track goals consistently
- Reconcile accounts regularly
- Use it as their main personal finance dashboard

## 13. MVP Focus
The initial version should prioritize:
- Manual tracking
- Account balance management
- Recurring payments and income
- Forecasting and shortfall alerts
- Loan and credit card tracking
- Goals tracking
- Reconciliation
- Local-first storage
- Mobile-friendly dashboard

## 14. Future Expansion
Potential future additions may include:
- Additional cloud providers
- Advanced reporting
- More detailed financial insights
- Automated import options
- Optional collaborative household finance modes
- Deeper investment analysis

## 15. Final Product Statement
A privacy-focused, local-first personal finance app that helps users track money, forecast future balances, model debt, reconcile accounts, and work toward financial goals with confidence.

