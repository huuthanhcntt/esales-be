export const PRODUCT_PATTERNS = {
  GET: 'product.get',
  CHECK_STOCK: 'product.check_stock',
  MARK_SOLD: 'product.mark_sold',
  UPDATED: 'product.updated',
} as const;

export const ORDER_PATTERNS = {
  CREATED: 'order.created',
  PAID: 'order.paid',
  CANCELLED: 'order.cancelled',
} as const;

export const MEDIA_PATTERNS = {
  UPLOAD: 'media.upload',
  DELETE: 'media.delete',
  GET_URL: 'media.get_url',
} as const;
