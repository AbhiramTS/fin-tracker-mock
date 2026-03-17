# Functional Requirements Document (FRD)

## 1. Document Purpose

This document defines what the personal finance application must do from a user and business functionality perspective.

## 2. Product Summary

The application is a local-first, mobile-friendly personal finance system that lets users manually track money, predict future balances, model obligations, reconcile accounts, and monitor financial goals.

## 3. Functional Scope

The system must support:

- Manual financial data entry
- Daily expense tracking
- Income tracking
- Account management
- Recurring payments and recurring income
- Loan and credit card tracking
- Full amortisation generation
- Money lent tracking
- Forecasting of future balances
- Alerts and notifications for shortfalls and due payments
- Financial goals tracking
- Account reconciliation
- Double-entry accounting logic
- Visual charts and insights
- QR-based device sync
- Optional backend sync
- PWA installation and mobile-friendly usage

## 4. Core Functional Requirements

### 4.1 User Data Entry

The application shall allow users to manually add:

- Expenses
- Income
- Transfers
- Recurring income
- Recurring payments
- Loans
- Credit card dues
- Credit card loans
- Money lent to others
- Reconciliation adjustments
- Financial goals

### 4.2 Account Management

The application shall allow users to create and manage accounts such as:

- Bank accounts
- Cash wallets
- Credit cards
- Loan accounts
- Investment accounts
- Receivable accounts for money lent

### 4.3 Double-Entry Recording

Every financial event shall be represented as a balanced set of ledger entries. The system shall support assets, liabilities, income, and expense accounts.

### 4.4 Loan Tracking

The application shall allow users to add both:

- Normal loans
- Credit card-linked loans

For each loan, the application shall generate a full amortisation schedule, including:

- Principal portion
- Interest portion
- Remaining balance after each payment
- EMI schedule
- Final payoff date

Credit card-linked loans shall be tracked separately from normal loans and reflected in the credit card bill structure.

### 4.5 Credit Card Tracking

The application shall support:

- Credit card bills
- Due dates
- Outstanding balances
- Credit card EMIs
- Credit card-linked loan allocation

### 4.6 Recurring Items

The application shall allow users to define recurring:

- Income items
- Payments
- EMIs
- Subscriptions
- Other repeating financial obligations

### 4.7 Forecasting

The application shall forecast future account balances using:

- Current balances
- Scheduled income
- Scheduled payments
- Recurring obligations
- Loan amortisation schedules
- Known repayments due from others

The forecast shall present projected balances for future dates and identify the date and amount of any expected shortfall.

### 4.8 Alerts

The application shall notify users of:

- Upcoming payments
- EMI due dates
- Credit card due dates
- Expected shortfalls
- Goal milestone progress
- Reconciliation reminders if enabled

### 4.9 Safe-to-Spend Calculation

The application shall calculate a safe-to-spend amount after reserving money for upcoming obligations, goals, and known commitments.

### 4.10 Simulation / Impact Preview

The application shall allow users to simulate the impact of future financial actions, such as:

- Taking a loan
- Adding a recurring payment
- Making a large purchase
- Increasing an EMI burden
- Adding a new goal contribution

The simulation shall show projected impact on balances and shortfall risk.

### 4.11 Money Lent Tracking

The application shall allow users to track money lent to individuals or entities as receivables.
The system shall support:

- Amount lent
- Person or entity name
- Date lent
- Expected repayment date
- Partial repayments
- Outstanding amount

### 4.12 Account Reconciliation

The application shall allow users to compare the tracked balance of an account against the actual real-world balance.
If there is a difference, the user shall be able to reconcile the account by either:

- Adding a missing transaction
- Recording a reconciliation adjustment

### 4.13 Financial Goals

The application shall support goals of multiple types:

- Short-term
- Interim/medium-term
- Long-term

Goal categories may include:

- Savings goals
- Debt reduction goals
- Investment targets

The application shall show goal progress, expected completion estimates, and contribution status.

### 4.14 Dashboards and Visualizations

The application shall provide visual summaries including:

- Balance over time
- Expense category charts
- Debt and liability charts
- Goal progress charts
- Net worth visualization
- Cash flow forecast charts

### 4.15 Sync and Portability

The application shall:

- Store data locally first
- Support optional sync to a backend of the user’s choice
- Support cloud sync providers such as Firebase or similar services
- Allow QR-based device pairing for desktop-to-mobile sync
- Continue functioning when offline

### 4.16 PWA Behavior

The application shall be installable as a Progressive Web App and optimized for mobile-first usage.

## 5. User Roles

### Standard User

Can manage personal financial data, goals, forecasts, and sync options.

### Advanced User

May use more complex features such as loans, reconciliation, receivables, and simulations.

## 6. Functional Rules

- Local data shall be the primary source of truth.
- Cloud sync shall be optional.
- Data should remain usable even if no backend is configured.
- Credit card loans shall not be merged with normal loans in the user view.
- Loan amortisation shall be visible for all loans.
- Double-entry logic shall maintain balanced records.
- Reconciliation adjustments must be visible and auditable.

## 7. Acceptance-Level Functional Outcomes

- Users can record and review all important personal finance activity.
- Users can see future balance changes before they happen.
- Users can identify financial shortfalls early.
- Users can understand loan impact before committing.
- Users can reconcile account balances accurately.
- Users can track progress toward savings and debt goals.
- Users can use the product comfortably on mobile devices.
