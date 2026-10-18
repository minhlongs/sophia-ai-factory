'use client';

import type { VideoAspectRatio, VideoDeliverable } from './portal-types';

export function getInitialPortalDeliverables(isVi: boolean): VideoDeliverable[] {
  return [
    {
      id: 'vid-101',
      title: isVi ? 'Chiến dịch Ra mắt Sản phẩm Mùa Thu' : 'Autumn Product Launch Campaign',
      platform: 'TikTok',
      duration: '0:35',
      aspectRatio: '9:16',
      status: 'ready',
      createdAt: isVi ? 'Hôm nay, 09:30' : 'Today, 09:30 AM',
      thumbnailColor: '#1e293b',
    },
    {
      id: 'vid-102',
      title: isVi ? 'Video Đánh giá Khách hàng & Feedback' : 'Customer Review & Testimonial Reel',
      platform: 'Reels',
      duration: '0:45',
      aspectRatio: '9:16',
      status: 'ready',
      createdAt: isVi ? 'Hôm qua' : 'Yesterday',
      thumbnailColor: '#0f172a',
    },
    {
      id: 'vid-103',
      title: isVi ? 'Video Giới thiệu Tính năng Công nghệ' : 'Tech Feature Explainer Shorts',
      platform: 'YouTube Shorts',
      duration: '0:58',
      aspectRatio: '16:9',
      status: 'rendering',
      createdAt: isVi ? '2 ngày trước' : '2 days ago',
      thumbnailColor: '#334155',
    },
  ];
}

export function createNewVideoDeliverable(
  title: string,
  selectedRatio: VideoAspectRatio,
  isVi: boolean,
): VideoDeliverable {
  return {
    id: `vid-${Date.now().toString().slice(-4)}`,
    title,
    platform: selectedRatio === '9:16' ? 'TikTok' : selectedRatio === '16:9' ? 'YouTube Shorts' : 'Reels',
    duration: '0:30',
    aspectRatio: selectedRatio,
    status: 'rendering',
    createdAt: isVi ? 'Vừa xong' : 'Just now',
    thumbnailColor: '#1e293b',
  };
}
