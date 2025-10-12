# DukaaOn ERP System - Step-by-Step Implementation Roadmap

## Overview
This document outlines the complete implementation plan for transforming DukaaOn into a full-featured ERP system for wholesalers, manufacturers, and distributors.

## Implementation Phases

### Phase 1: Foundation & Core Infrastructure (Weeks 1-12)

#### Week 1-2: Database Schema Enhancement
```sql
-- 1.1 Enhanced User Management
ALTER TABLE profiles ADD COLUMN department_id UUID;
ALTER TABLE profiles ADD COLUMN employee_id VARCHAR(50);
ALTER TABLE profiles ADD COLUMN permissions JSONB;

-- 1.2 Create Departments Table
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    manager_id UUID REFERENCES profiles(id),
    parent_department_id UUID REFERENCES departments(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 1.3 Create Audit Trail Table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    user_id UUID REFERENCES profiles(id),
    timestamp TIMESTAMP DEFAULT NOW()
);
```

#### Week 3-4: Role-Based Access Control (RBAC)
```typescript
// Create RBAC system
// File: web-console/lib/rbac.ts
export interface Permission {
  module: string;
  action: 'create' | 'read' | 'update' | 'delete';
  resource?: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

// Predefined roles
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
  VIEWER: 'viewer'
};
```

#### Week 5-6: Enhanced Authentication System
```typescript
// File: web-console/contexts/AuthContext.tsx
// Add department and role management
interface AuthUser {
  id: string;
  email: string;
  role: string;
  department: Department;
  permissions: Permission[];
}
```

#### Week 7-8: API Layer Enhancement
```typescript
// File: web-console/lib/api/base.ts
// Create standardized API layer with error handling
export class BaseAPI {
  protected supabase = createClient();
  
  async create<T>(table: string, data: Partial<T>): Promise<T> {
    // Implementation with audit logging
  }
  
  async update<T>(table: string, id: string, data: Partial<T>): Promise<T> {
    // Implementation with audit logging
  }
  
  async delete(table: string, id: string): Promise<void> {
    // Soft delete implementation
  }
}
```

#### Week 9-10: Enhanced UI Components
```typescript
// File: web-console/components/common/DataTable.tsx
// Create reusable data table with sorting, filtering, pagination

// File: web-console/components/common/FormBuilder.tsx
// Dynamic form builder for different modules

// File: web-console/components/common/Dashboard.tsx
// Reusable dashboard components
```

#### Week 11-12: Testing & Documentation
- Unit tests for core functions
- API documentation
- User guide for Phase 1 features

### Phase 2: Supply Chain Management (Weeks 13-24)

#### Week 13-14: Supplier Management
```sql
-- 2.1 Suppliers Table
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_code VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address JSONB,
    gst_number VARCHAR(15),
    pan_number VARCHAR(10),
    bank_details JSONB,
    payment_terms VARCHAR(50),
    credit_limit DECIMAL(15,2),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    status VARCHAR(20) DEFAULT 'active',
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2.2 Supplier Categories
CREATE TABLE supplier_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2.3 Supplier Category Mapping
CREATE TABLE supplier_category_mapping (
    supplier_id UUID REFERENCES suppliers(id),
    category_id UUID REFERENCES supplier_categories(id),
    PRIMARY KEY (supplier_id, category_id)
);
```

#### Week 15-16: Purchase Order Management
```sql
-- 2.4 Purchase Orders
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id),
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    status VARCHAR(20) DEFAULT 'draft',
    total_amount DECIMAL(15,2),
    tax_amount DECIMAL(15,2),
    discount_amount DECIMAL(15,2),
    grand_total DECIMAL(15,2),
    terms_and_conditions TEXT,
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2.5 Purchase Order Items
CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID REFERENCES purchase_orders(id),
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL,
    received_quantity INTEGER DEFAULT 0,
    pending_quantity INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Week 17-18: Goods Receipt Management
```sql
-- 2.6 Goods Receipt Notes
CREATE TABLE goods_receipt_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_number VARCHAR(50) UNIQUE NOT NULL,
    po_id UUID REFERENCES purchase_orders(id),
    supplier_id UUID REFERENCES suppliers(id),
    receipt_date DATE NOT NULL,
    invoice_number VARCHAR(50),
    invoice_date DATE,
    total_received_amount DECIMAL(15,2),
    quality_check_status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    received_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2.7 GRN Items
CREATE TABLE grn_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id UUID REFERENCES goods_receipt_notes(id),
    po_item_id UUID REFERENCES purchase_order_items(id),
    product_id UUID REFERENCES products(id),
    ordered_quantity INTEGER,
    received_quantity INTEGER,
    accepted_quantity INTEGER,
    rejected_quantity INTEGER,
    unit_price DECIMAL(10,2),
    total_amount DECIMAL(15,2),
    batch_number VARCHAR(50),
    expiry_date DATE,
    quality_remarks TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Week 19-20: Supplier Performance Analytics
```typescript
// File: web-console/app/supply-chain/analytics/page.tsx
// Supplier performance dashboard
// - On-time delivery rates
// - Quality metrics
// - Cost analysis
// - Payment history
```

#### Week 21-22: Purchase Workflows
```typescript
// File: web-console/lib/workflows/purchase.ts
// Automated purchase workflows
// - Approval workflows
// - Auto-reorder based on stock levels
// - Supplier selection algorithms
```

#### Week 23-24: Testing & Integration
- Integration testing for supply chain module
- User acceptance testing
- Performance optimization

### Phase 3: Advanced Inventory Management (Weeks 25-36)

#### Week 25-26: Multi-Warehouse Management
```sql
-- 3.1 Warehouses
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    address JSONB,
    manager_id UUID REFERENCES profiles(id),
    capacity DECIMAL(15,2),
    current_utilization DECIMAL(15,2),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3.2 Storage Locations
CREATE TABLE storage_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID REFERENCES warehouses(id),
    location_code VARCHAR(50) NOT NULL,
    aisle VARCHAR(10),
    rack VARCHAR(10),
    shelf VARCHAR(10),
    bin VARCHAR(10),
    capacity DECIMAL(10,2),
    current_stock DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(warehouse_id, location_code)
);

-- 3.3 Stock Locations
CREATE TABLE stock_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id),
    warehouse_id UUID REFERENCES warehouses(id),
    location_id UUID REFERENCES storage_locations(id),
    quantity DECIMAL(10,2) NOT NULL,
    reserved_quantity DECIMAL(10,2) DEFAULT 0,
    available_quantity DECIMAL(10,2),
    reorder_level DECIMAL(10,2),
    max_stock_level DECIMAL(10,2),
    last_updated TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (product_id, warehouse_id, location_id)
);
```

#### Week 27-28: Batch/Lot Tracking
```sql
-- 3.4 Batches/Lots
CREATE TABLE product_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number VARCHAR(50) NOT NULL,
    product_id UUID REFERENCES products(id),
    supplier_id UUID REFERENCES suppliers(id),
    manufacturing_date DATE,
    expiry_date DATE,
    quantity_received DECIMAL(10,2),
    quantity_available DECIMAL(10,2),
    cost_per_unit DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(batch_number, product_id)
);

-- 3.5 Batch Movements
CREATE TABLE batch_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES product_batches(id),
    movement_type VARCHAR(20), -- IN, OUT, TRANSFER, ADJUSTMENT
    quantity DECIMAL(10,2),
    from_location_id UUID REFERENCES storage_locations(id),
    to_location_id UUID REFERENCES storage_locations(id),
    reference_type VARCHAR(50), -- PO, SALE, TRANSFER, ADJUSTMENT
    reference_id UUID,
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Week 29-30: Stock Transfer Management
```sql
-- 3.6 Stock Transfers
CREATE TABLE stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number VARCHAR(50) UNIQUE NOT NULL,
    from_warehouse_id UUID REFERENCES warehouses(id),
    to_warehouse_id UUID REFERENCES warehouses(id),
    transfer_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    requested_by UUID REFERENCES profiles(id),
    approved_by UUID REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3.7 Stock Transfer Items
CREATE TABLE stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID REFERENCES stock_transfers(id),
    product_id UUID REFERENCES products(id),
    batch_id UUID REFERENCES product_batches(id),
    requested_quantity DECIMAL(10,2),
    transferred_quantity DECIMAL(10,2),
    received_quantity DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Week 31-32: Inventory Valuation
```typescript
// File: web-console/lib/inventory/valuation.ts
// Inventory valuation methods
// - FIFO (First In, First Out)
// - LIFO (Last In, First Out)
// - Weighted Average
// - Standard Cost

export class InventoryValuation {
  async calculateFIFO(productId: string): Promise<number> {
    // Implementation
  }
  
  async calculateWeightedAverage(productId: string): Promise<number> {
    // Implementation
  }
  
  async generateValuationReport(warehouseId?: string): Promise<ValuationReport> {
    // Implementation
  }
}
```

#### Week 33-34: Cycle Counting & Physical Inventory
```sql
-- 3.8 Cycle Counts
CREATE TABLE cycle_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_number VARCHAR(50) UNIQUE NOT NULL,
    warehouse_id UUID REFERENCES warehouses(id),
    count_date DATE NOT NULL,
    count_type VARCHAR(20), -- FULL, PARTIAL, ABC
    status VARCHAR(20) DEFAULT 'planned',
    planned_by UUID REFERENCES profiles(id),
    counted_by UUID REFERENCES profiles(id),
    approved_by UUID REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3.9 Cycle Count Items
CREATE TABLE cycle_count_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_count_id UUID REFERENCES cycle_counts(id),
    product_id UUID REFERENCES products(id),
    location_id UUID REFERENCES storage_locations(id),
    batch_id UUID REFERENCES product_batches(id),
    system_quantity DECIMAL(10,2),
    counted_quantity DECIMAL(10,2),
    variance DECIMAL(10,2),
    variance_value DECIMAL(15,2),
    reason_code VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Week 35-36: Inventory Analytics & Reports
```typescript
// File: web-console/app/inventory/analytics/page.tsx
// Advanced inventory analytics
// - ABC Analysis
// - Slow-moving stock analysis
// - Stock aging reports
// - Inventory turnover ratios
// - Demand forecasting
```

### Phase 4: Manufacturing Resource Planning (Weeks 37-48)

#### Week 37-38: Bill of Materials (BOM)
```sql
-- 4.1 Bill of Materials
CREATE TABLE bill_of_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_number VARCHAR(50) UNIQUE NOT NULL,
    product_id UUID REFERENCES products(id),
    version VARCHAR(10) DEFAULT '1.0',
    status VARCHAR(20) DEFAULT 'active',
    effective_date DATE,
    expiry_date DATE,
    created_by UUID REFERENCES profiles(id),
    approved_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4.2 BOM Items
CREATE TABLE bom_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID REFERENCES bill_of_materials(id),
    component_id UUID REFERENCES products(id),
    quantity DECIMAL(10,4) NOT NULL,
    unit VARCHAR(20),
    scrap_percentage DECIMAL(5,2) DEFAULT 0,
    sequence_number INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Week 39-40: Work Centers & Routing
```sql
-- 4.3 Work Centers
CREATE TABLE work_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_center_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    capacity_per_hour DECIMAL(10,2),
    cost_per_hour DECIMAL(10,2),
    setup_time_minutes INTEGER DEFAULT 0,
    efficiency_percentage DECIMAL(5,2) DEFAULT 100,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4.4 Routing Operations
CREATE TABLE routing_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID REFERENCES bill_of_materials(id),
    operation_number INTEGER NOT NULL,
    work_center_id UUID REFERENCES work_centers(id),
    operation_description TEXT,
    setup_time_minutes INTEGER DEFAULT 0,
    run_time_minutes DECIMAL(10,2),
    queue_time_minutes INTEGER DEFAULT 0,
    move_time_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Week 41-42: Production Orders
```sql
-- 4.5 Production Orders
CREATE TABLE production_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_order_number VARCHAR(50) UNIQUE NOT NULL,
    product_id UUID REFERENCES products(id),
    bom_id UUID REFERENCES bill_of_materials(id),
    quantity_to_produce DECIMAL(10,2),
    quantity_produced DECIMAL(10,2) DEFAULT 0,
    start_date DATE,
    due_date DATE,
    actual_start_date DATE,
    actual_completion_date DATE,
    status VARCHAR(20) DEFAULT 'planned',
    priority INTEGER DEFAULT 5,
    created_by UUID REFERENCES profiles(id),
    assigned_to UUID REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4.6 Production Order Operations
CREATE TABLE production_order_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_order_id UUID REFERENCES production_orders(id),
    routing_operation_id UUID REFERENCES routing_operations(id),
    sequence_number INTEGER,
    status VARCHAR(20) DEFAULT 'pending',
    planned_start_date TIMESTAMP,
    planned_end_date TIMESTAMP,
    actual_start_date TIMESTAMP,
    actual_end_date TIMESTAMP,
    setup_time_actual INTEGER,
    run_time_actual DECIMAL(10,2),
    quantity_completed DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Week 43-44: Material Requirements Planning (MRP)
```typescript
// File: web-console/lib/manufacturing/mrp.ts
// MRP calculation engine
export class MRPEngine {
  async calculateMaterialRequirements(
    productionPlan: ProductionPlan[]
  ): Promise<MaterialRequirement[]> {
    // Implementation for MRP calculation
    // - Gross requirements calculation
    // - Net requirements calculation
    // - Planned order releases
    // - Lead time offsetting
  }
  
  async generatePurchaseRequisitions(
    materialRequirements: MaterialRequirement[]
  ): Promise<PurchaseRequisition[]> {
    // Auto-generate purchase requisitions
  }
}
```

#### Week 45-46: Quality Control
```sql
-- 4.7 Quality Control Plans
CREATE TABLE quality_control_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id),
    operation_id UUID REFERENCES routing_operations(id),
    inspection_type VARCHAR(50), -- INCOMING, IN_PROCESS, FINAL
    sampling_plan VARCHAR(100),
    acceptance_criteria TEXT,
    test_methods TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4.8 Quality Inspections
CREATE TABLE quality_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_number VARCHAR(50) UNIQUE NOT NULL,
    production_order_id UUID REFERENCES production_orders(id),
    qc_plan_id UUID REFERENCES quality_control_plans(id),
    inspection_date DATE,
    inspector_id UUID REFERENCES profiles(id),
    sample_size INTEGER,
    passed_quantity INTEGER,
    failed_quantity INTEGER,
    status VARCHAR(20), -- PASSED, FAILED, PENDING
    remarks TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Week 47-48: Production Analytics
```typescript
// File: web-console/app/manufacturing/analytics/page.tsx
// Manufacturing analytics dashboard
// - Production efficiency metrics
// - OEE (Overall Equipment Effectiveness)
// - Capacity utilization
// - Quality metrics
// - Cost analysis
```

### Phase 5: Financial Management (Weeks 49-60)

#### Week 49-50: Chart of Accounts
```sql
-- 5.1 Chart of Accounts
CREATE TABLE chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_code VARCHAR(20) UNIQUE NOT NULL,
    account_name VARCHAR(100) NOT NULL,
    account_type VARCHAR(50), -- ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
    parent_account_id UUID REFERENCES chart_of_accounts(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5.2 Journal Entries
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_number VARCHAR(50) UNIQUE NOT NULL,
    entry_date DATE NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    description TEXT,
    total_debit DECIMAL(15,2),
    total_credit DECIMAL(15,2),
    status VARCHAR(20) DEFAULT 'draft',
    created_by UUID REFERENCES profiles(id),
    approved_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5.3 Journal Entry Lines
CREATE TABLE journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID REFERENCES journal_entries(id),
    account_id UUID REFERENCES chart_of_accounts(id),
    debit_amount DECIMAL(15,2) DEFAULT 0,
    credit_amount DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Week 51-52: Accounts Receivable
```sql
-- 5.4 Customer Invoices
CREATE TABLE customer_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID REFERENCES profiles(id),
    order_id UUID REFERENCES orders(id),
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal DECIMAL(15,2),
    tax_amount DECIMAL(15,2),
    discount_amount DECIMAL(15,2),
    total_amount DECIMAL(15,2),
    paid_amount DECIMAL(15,2) DEFAULT 0,
    balance_amount DECIMAL(15,2),
    status VARCHAR(20) DEFAULT 'pending',
    payment_terms VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5.5 Customer Payments
CREATE TABLE customer_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID REFERENCES profiles(id),
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50),
    reference_number VARCHAR(100),
    total_amount DECIMAL(15,2),
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5.6 Payment Allocations
CREATE TABLE payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES customer_payments(id),
    invoice_id UUID REFERENCES customer_invoices(id),
    allocated_amount DECIMAL(15,2),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Week 53-54: Accounts Payable
```sql
-- 5.7 Supplier Invoices
CREATE TABLE supplier_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) NOT NULL,
    supplier_invoice_number VARCHAR(50),
    supplier_id UUID REFERENCES suppliers(id),
    po_id UUID REFERENCES purchase_orders(id),
    grn_id UUID REFERENCES goods_receipt_notes(id),
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal DECIMAL(15,2),
    tax_amount DECIMAL(15,2),
    total_amount DECIMAL(15,2),
    paid_amount DECIMAL(15,2) DEFAULT 0,
    balance_amount DECIMAL(15,2),
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5.8 Supplier Payments
CREATE TABLE supplier_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id),
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50),
    reference_number VARCHAR(100),
    total_amount DECIMAL(15,2),
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Week 55-56: Tax Management
```sql
-- 5.9 Tax Configurations
CREATE TABLE tax_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tax_code VARCHAR(20) UNIQUE NOT NULL,
    tax_name VARCHAR(100) NOT NULL,
    tax_type VARCHAR(50), -- GST, VAT, INCOME_TAX
    tax_rate DECIMAL(5,2),
    is_active BOOLEAN DEFAULT true,
    effective_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5.10 Tax Transactions
CREATE TABLE tax_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_type VARCHAR(50), -- SALE, PURCHASE
    transaction_id UUID,
    tax_config_id UUID REFERENCES tax_configurations(id),
    taxable_amount DECIMAL(15,2),
    tax_amount DECIMAL(15,2),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Week 57-58: Financial Reporting
```typescript
// File: web-console/lib/financial/reports.ts
// Financial reporting engine
export class FinancialReports {
  async generateProfitLoss(
    startDate: Date,
    endDate: Date
  ): Promise<ProfitLossReport> {
    // P&L statement generation
  }
  
  async generateBalanceSheet(asOfDate: Date): Promise<BalanceSheetReport> {
    // Balance sheet generation
  }
  
  async generateCashFlow(
    startDate: Date,
    endDate: Date
  ): Promise<CashFlowReport> {
    // Cash flow statement
  }
  
  async generateAgeingReport(
    reportType: 'receivables' | 'payables'
  ): Promise<AgeingReport> {
    // Ageing analysis
  }
}
```

#### Week 59-60: Financial Analytics
```typescript
// File: web-console/app/financial/analytics/page.tsx
// Financial analytics dashboard
// - Key financial ratios
// - Trend analysis
// - Budget vs actual
// - Cash flow forecasting
```

### Phase 6: Human Resources Management (Weeks 61-72)

#### Week 61-62: Employee Management
```sql
-- 6.1 Employees
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID REFERENCES profiles(id),
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    date_of_birth DATE,
    date_of_joining DATE,
    department_id UUID REFERENCES departments(id),
    designation VARCHAR(100),
    reporting_manager_id UUID REFERENCES employees(id),
    employment_type VARCHAR(50), -- PERMANENT, CONTRACT, INTERN
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6.2 Employee Addresses
CREATE TABLE employee_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    address_type VARCHAR(20), -- CURRENT, PERMANENT
    address_line1 VARCHAR(200),
    address_line2 VARCHAR(200),
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    country VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Week 63-64: Attendance Management
```sql
-- 6.3 Attendance
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    attendance_date DATE NOT NULL,
    check_in_time TIME,
    check_out_time TIME,
    total_hours DECIMAL(4,2),
    overtime_hours DECIMAL(4,2),
    status VARCHAR(20), -- PRESENT, ABSENT, HALF_DAY, HOLIDAY
    remarks TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(employee_id, attendance_date)
);

-- 6.4 Leave Types
CREATE TABLE leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_type_code VARCHAR(20) UNIQUE NOT NULL,
    leave_type_name VARCHAR(100) NOT NULL,
    max_days_per_year INTEGER,
    carry_forward_allowed BOOLEAN DEFAULT false,
    is_paid BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6.5 Leave Applications
CREATE TABLE leave_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    leave_type_id UUID REFERENCES leave_types(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    applied_date DATE DEFAULT CURRENT_DATE,
    approved_by UUID REFERENCES employees(id),
    approved_date DATE,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Week 65-66: Payroll Management
```sql
-- 6.6 Salary Components
CREATE TABLE salary_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_code VARCHAR(20) UNIQUE NOT NULL,
    component_name VARCHAR(100) NOT NULL,
    component_type VARCHAR(20), -- EARNING, DEDUCTION
    is_taxable BOOLEAN DEFAULT true,
    calculation_type VARCHAR(20), -- FIXED, PERCENTAGE
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6.7 Employee Salary Structure
CREATE TABLE employee_salary_structure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    component_id UUID REFERENCES salary_components(id),
    amount DECIMAL(10,2),
    percentage DECIMAL(5,2),
    effective_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6.8 Payroll
CREATE TABLE payroll (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    pay_period_start DATE,
    pay_period_end DATE,
    gross_salary DECIMAL(15,2),
    total_deductions DECIMAL(15,2),
    net_salary DECIMAL(15,2),
    status VARCHAR(20) DEFAULT 'draft',
    processed_date DATE,
    processed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Week 67-68: Performance Management
```sql
-- 6.9 Performance Reviews
CREATE TABLE performance_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    reviewer_id UUID REFERENCES employees(id),
    review_period_start DATE,
    review_period_end DATE,
    overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
    goals_achieved TEXT,
    areas_of_improvement TEXT,
    feedback TEXT,
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6.10 Training Records
CREATE TABLE training_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    training_name VARCHAR(200),
    training_provider VARCHAR(200),
    start_date DATE,
    end_date DATE,
    status VARCHAR(20), -- PLANNED, IN_PROGRESS, COMPLETED
    certification_received BOOLEAN DEFAULT false,
    cost DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Week 69-70: HR Analytics
```typescript
// File: web-console/app/hr/analytics/page.tsx
// HR analytics dashboard
// - Employee turnover rates
// - Attendance patterns
// - Performance metrics
// - Training effectiveness
// - Salary analysis
```

#### Week 71-72: HR Workflows
```typescript
// File: web-console/lib/hr/workflows.ts
// HR workflow automation
// - Employee onboarding
// - Leave approval workflows
// - Performance review cycles
// - Training scheduling
```

## Implementation Guidelines

### Development Best Practices

1. **Code Organization**
   ```
   web-console/
   ├── app/
   │   ├── supply-chain/
   │   ├── inventory/
   │   ├── manufacturing/
   │   ├── financial/
   │   └── hr/
   ├── components/
   │   ├── supply-chain/
   │   ├── inventory/
   │   ├── manufacturing/
   │   ├── financial/
   │   └── hr/
   └── lib/
       ├── api/
       ├── workflows/
       └── reports/
   ```

2. **Database Migrations**
   - Create migration files for each phase
   - Include rollback scripts
   - Test migrations on staging environment

3. **Testing Strategy**
   - Unit tests for business logic
   - Integration tests for API endpoints
   - E2E tests for critical workflows
   - Performance testing for large datasets

4. **Documentation**
   - API documentation with Swagger
   - User manuals for each module
   - Technical documentation for developers
   - Video tutorials for end users

### Technology Stack Enhancements

1. **Backend Enhancements**
   ```typescript
   // Add to package.json
   {
     "dependencies": {
       "@supabase/supabase-js": "^2.0.0",
       "redis": "^4.0.0",
       "bull": "^4.0.0", // Job queue
       "node-cron": "^3.0.0", // Scheduled tasks
       "pdf-lib": "^1.17.0", // PDF generation
       "xlsx": "^0.18.0", // Excel export
       "nodemailer": "^6.9.0", // Email notifications
       "winston": "^3.8.0" // Logging
     }
   }
   ```

2. **Frontend Enhancements**
   ```typescript
   // Add to package.json
   {
     "dependencies": {
       "@tanstack/react-query": "^4.0.0",
       "zustand": "^4.0.0",
       "react-hook-form": "^7.0.0",
       "yup": "^1.0.0",
       "date-fns": "^2.29.0",
       "recharts": "^2.5.0",
       "react-pdf": "^6.2.0"
     }
   }
   ```

### Deployment Strategy

1. **Environment Setup**
   - Development: Local development with Supabase local
   - Staging: Cloud environment for testing
   - Production: Scalable cloud deployment

2. **CI/CD Pipeline**
   ```yaml
   # .github/workflows/deploy.yml
   name: Deploy ERP System
   on:
     push:
       branches: [main, staging]
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - name: Run tests
           run: npm test
     deploy:
       needs: test
       runs-on: ubuntu-latest
       steps:
         - name: Deploy to Vercel
           run: vercel --prod
   ```

### Security Considerations

1. **Data Security**
   - Encrypt sensitive data at rest
   - Use HTTPS for all communications
   - Implement proper session management
   - Regular security audits

2. **Access Control**
   - Role-based permissions
   - API rate limiting
   - Input validation and sanitization
   - SQL injection prevention

### Performance Optimization

1. **Database Optimization**
   - Proper indexing strategy
   - Query optimization
   - Connection pooling
   - Read replicas for reporting

2. **Frontend Optimization**
   - Code splitting by modules
   - Lazy loading of components
   - Image optimization
   - Caching strategies

## Success Metrics

### Phase 1 Success Criteria
- [ ] RBAC system implemented and tested
- [ ] Audit logging functional
- [ ] Enhanced UI components ready
- [ ] API layer standardized

### Phase 2 Success Criteria
- [ ] Supplier management fully functional
- [ ] Purchase order workflow complete
- [ ] GRN processing implemented
- [ ] Supplier analytics dashboard ready

### Phase 3 Success Criteria
- [ ] Multi-warehouse management operational
- [ ] Batch tracking implemented
- [ ] Stock transfer workflows functional
- [ ] Inventory valuation accurate

### Phase 4 Success Criteria
- [ ] BOM management complete
- [ ] Production planning functional
- [ ] Quality control workflows operational
- [ ] Manufacturing analytics ready

### Phase 5 Success Criteria
- [ ] Financial accounting functional
- [ ] Invoice generation automated
- [ ] Payment processing complete
- [ ] Financial reports accurate

### Phase 6 Success Criteria
- [ ] Employee management operational
- [ ] Payroll processing automated
- [ ] Performance management functional
- [ ] HR analytics dashboard ready

## Risk Mitigation

### Technical Risks
1. **Database Performance**
   - Mitigation: Implement proper indexing and query optimization
   - Monitoring: Set up performance monitoring alerts

2. **Data Migration**
   - Mitigation: Thorough testing of migration scripts
   - Backup: Complete data backup before migrations

3. **Integration Complexity**
   - Mitigation: Modular development approach
   - Testing: Comprehensive integration testing

### Business Risks
1. **User Adoption**
   - Mitigation: Comprehensive training programs
   - Support: Dedicated support team during rollout

2. **Data Accuracy**
   - Mitigation: Data validation rules and audit trails
   - Monitoring: Regular data quality checks

## Conclusion

This roadmap provides a comprehensive plan for implementing a full ERP system in your DukaaOn web application. The phased approach ensures manageable development cycles while building upon your existing foundation. Each phase delivers tangible business value while preparing for subsequent phases.

The estimated timeline of 72 weeks (approximately 18 months) allows for thorough development, testing, and user training. The modular approach ensures that you can start realizing benefits from early phases while continuing development of advanced features.

Regular reviews and adjustments to this roadmap will be necessary based on user feedback, technical challenges, and changing business requirements.