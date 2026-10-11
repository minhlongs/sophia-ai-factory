import {
  listAllHelpVideos,
  listPublishedHelpVideos,
  getHelpVideoBySlug,
  getHelpVideoForTooltip,
  listHelpVideosByCategory,
  getHelpVideoById,
} from './video-query-builder';
import {
  createHelpVideo,
  updateHelpVideo,
  deleteHelpVideo,
} from './cache-indexer';

export const helpVideoService = {
  listAll: listAllHelpVideos,
  listPublished: listPublishedHelpVideos,
  getBySlug: getHelpVideoBySlug,
  getForTooltip: getHelpVideoForTooltip,
  listByCategory: listHelpVideosByCategory,
  getById: getHelpVideoById,
  create: createHelpVideo,
  update: updateHelpVideo,
  delete: deleteHelpVideo,
};
