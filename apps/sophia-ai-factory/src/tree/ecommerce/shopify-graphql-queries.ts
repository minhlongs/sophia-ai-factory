/**
 * Shopify Admin GraphQL Queries and Node Types
 *
 * Layer: tree/ecommerce
 * @module tree/ecommerce/shopify-graphql-queries
 */

export interface ShopifyProductNode {
  id: string;
  title: string;
  descriptionHtml?: string;
  vendor?: string;
  productType?: string;
  status: string;
  tags: string[];
  onlineStoreUrl?: string;
  variants?: {
    edges: Array<{
      node: {
        price: string;
      };
    }>;
  };
  images?: {
    edges: Array<{
      node: {
        url: string;
      };
    }>;
  };
}

export const PRODUCTS_QUERY = `
query GetProducts($first: Int!, $query: String) {
  products(first: $first, query: $query) {
    edges {
      node {
        id
        title
        descriptionHtml
        vendor
        productType
        status
        tags
        onlineStoreUrl
        variants(first: 1) {
          edges {
            node {
              price
            }
          }
        }
        images(first: 5) {
          edges {
            node {
              url
            }
          }
        }
      }
    }
  }
}
`;
