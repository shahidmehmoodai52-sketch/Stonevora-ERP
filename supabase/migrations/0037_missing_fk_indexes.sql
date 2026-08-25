-- Performance advisor found several unindexed foreign keys on the tables
-- added this session. All INFO-level (not urgent), but cheap and safe to add
-- now rather than carry them forward -- matches the standing rule to avoid
-- missing indexes as the transaction volume this schema will eventually
-- carry grows.
create index idx_category_attribute_templates_attribute_type_id on category_attribute_templates (attribute_type_id);
create index idx_product_numeric_attributes_attribute_type_id on product_numeric_attributes (attribute_type_id);
create index idx_product_numeric_attributes_uom_id on product_numeric_attributes (uom_id);
create index idx_stock_transfer_lines_uom_id on stock_transfer_lines (uom_id);
create index idx_stock_transfer_lines_tenant_id on stock_transfer_lines (tenant_id);
create index idx_stock_transfer_lines_source_location_id on stock_transfer_lines (source_location_id);
create index idx_stock_transfer_lines_destination_location_id on stock_transfer_lines (destination_location_id);
create index idx_stock_transfer_lines_destination_batch_id on stock_transfer_lines (destination_batch_id);
create index idx_stock_transfers_created_by on stock_transfers (created_by);
create index idx_tenant_capabilities_capability_id on tenant_capabilities (capability_id);
create index idx_tenant_capabilities_enabled_by on tenant_capabilities (enabled_by);
