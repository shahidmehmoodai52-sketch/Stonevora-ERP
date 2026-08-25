-- Global seed data: role templates, permission catalog, base UOM set, countries, currencies.

insert into role_templates (code, name, description) values
  ('owner', 'Owner', 'Full control over the tenant, including financial data and billing'),
  ('company_admin', 'Company Admin', 'Full operational control over the tenant'),
  ('factory_manager', 'Factory Manager', 'Oversees factory/production operations'),
  ('production_manager', 'Production Manager', 'Manages production orders and workflows'),
  ('purchase_manager', 'Purchase Manager', 'Manages suppliers and purchasing'),
  ('inventory_manager', 'Inventory Manager', 'Manages warehouses and stock'),
  ('qc_manager', 'QC Manager', 'Manages quality control'),
  ('sales_manager', 'Sales Manager', 'Manages sales operations'),
  ('salesperson', 'Salesperson', 'Handles customer sales, no cost/profit visibility'),
  ('accountant', 'Accountant', 'Manages financial records'),
  ('warehouse_staff', 'Warehouse Staff', 'Handles physical stock operations'),
  ('production_operator', 'Production Operator', 'Executes production tasks'),
  ('dispatch_staff', 'Dispatch Staff', 'Handles dispatch and logistics'),
  ('viewer', 'Viewer', 'Read-only access, no financial data');

insert into permissions (resource, action) select r.resource, a.action
from (values ('product'), ('company_settings'), ('warehouse'), ('user_management')) as r(resource)
cross join (values ('view'), ('create'), ('edit'), ('delete'), ('approve'), ('cancel'), ('print'), ('export'), ('view_cost'), ('view_profit'), ('view_financial')) as a(action);

insert into product_attribute_types (code, name) values
  ('material_type', 'Material Type'),
  ('variety', 'Variety'),
  ('brand', 'Brand'),
  ('collection', 'Collection'),
  ('color', 'Color'),
  ('pattern', 'Pattern'),
  ('origin', 'Origin'),
  ('grade', 'Grade'),
  ('finish', 'Finish'),
  ('surface', 'Surface'),
  ('application', 'Application');

insert into uom (tenant_id, code, name, category) values
  (null, 'PCS', 'Piece', 'count'),
  (null, 'BOX', 'Box', 'count'),
  (null, 'CTN', 'Carton', 'count'),
  (null, 'SLAB', 'Slab', 'count'),
  (null, 'BNDL', 'Bundle', 'count'),
  (null, 'PLT', 'Pallet', 'count'),
  (null, 'SQFT', 'Square Foot', 'area'),
  (null, 'SQM', 'Square Meter', 'area'),
  (null, 'RFT', 'Running Foot', 'length'),
  (null, 'RM', 'Running Meter', 'length'),
  (null, 'KG', 'Kilogram', 'weight'),
  (null, 'TON', 'Ton', 'weight'),
  (null, 'M3', 'Cubic Meter', 'volume');

-- Global fixed conversions (product_id null = generic, applies to any product using these units).
insert into uom_conversions (tenant_id, product_id, from_uom_id, to_uom_id, conversion_factor)
select null, null, sqm.id, sqft.id, 10.7639
from uom sqm, uom sqft
where sqm.code = 'SQM' and sqft.code = 'SQFT' and sqm.tenant_id is null and sqft.tenant_id is null;

insert into uom_conversions (tenant_id, product_id, from_uom_id, to_uom_id, conversion_factor)
select null, null, sqft.id, sqm.id, 0.092903
from uom sqft, uom sqm
where sqft.code = 'SQFT' and sqm.code = 'SQM' and sqft.tenant_id is null and sqm.tenant_id is null;

insert into uom_conversions (tenant_id, product_id, from_uom_id, to_uom_id, conversion_factor)
select null, null, rm.id, rft.id, 3.28084
from uom rm, uom rft
where rm.code = 'RM' and rft.code = 'RFT' and rm.tenant_id is null and rft.tenant_id is null;

insert into uom_conversions (tenant_id, product_id, from_uom_id, to_uom_id, conversion_factor)
select null, null, rft.id, rm.id, 0.3048
from uom rft, uom rm
where rft.code = 'RFT' and rm.code = 'RM' and rft.tenant_id is null and rm.tenant_id is null;

insert into uom_conversions (tenant_id, product_id, from_uom_id, to_uom_id, conversion_factor)
select null, null, ton.id, kg.id, 1000
from uom ton, uom kg
where ton.code = 'TON' and kg.code = 'KG' and ton.tenant_id is null and kg.tenant_id is null;

insert into uom_conversions (tenant_id, product_id, from_uom_id, to_uom_id, conversion_factor)
select null, null, kg.id, ton.id, 0.001
from uom kg, uom ton
where kg.code = 'KG' and ton.code = 'TON' and kg.tenant_id is null and ton.tenant_id is null;

insert into currencies (iso_code, name, symbol, decimal_places) values
  ('USD', 'US Dollar', '$', 2),
  ('EUR', 'Euro', '€', 2),
  ('GBP', 'British Pound', '£', 2),
  ('PKR', 'Pakistani Rupee', 'Rs', 2),
  ('INR', 'Indian Rupee', '₹', 2),
  ('AED', 'UAE Dirham', 'د.إ', 2),
  ('SAR', 'Saudi Riyal', '﷼', 2),
  ('CNY', 'Chinese Yuan', '¥', 2);

insert into countries (iso_code2, iso_code3, name) values
  ('US', 'USA', 'United States'),
  ('GB', 'GBR', 'United Kingdom'),
  ('PK', 'PAK', 'Pakistan'),
  ('IN', 'IND', 'India'),
  ('AE', 'ARE', 'United Arab Emirates'),
  ('SA', 'SAU', 'Saudi Arabia'),
  ('CN', 'CHN', 'China'),
  ('IT', 'ITA', 'Italy'),
  ('ES', 'ESP', 'Spain'),
  ('TR', 'TUR', 'Turkey'),
  ('BR', 'BRA', 'Brazil'),
  ('DE', 'DEU', 'Germany');
