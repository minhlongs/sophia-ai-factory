import { gql } from 'graphql-tag';
import { baseTypeDefs } from './types';
import { metricsTypeDefs } from './metrics-types';
import { rootTypeDefs } from './root-types';

export const typeDefs = gql`
  ${baseTypeDefs}
  ${metricsTypeDefs}
  ${rootTypeDefs}
`;
