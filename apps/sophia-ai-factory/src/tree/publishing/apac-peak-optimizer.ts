/**
 * APAC Peak-Time Scheduling Optimizer
 *
 * Implements golden hour scheduling for top APAC video growth markets:
 * - Hà Nội (UTC+7, Asia/Ho_Chi_Minh): 11:30 & 19:30
 * - Tokyo (UTC+9, Asia/Tokyo): 12:00 & 20:00
 * - Bangkok (UTC+7, Asia/Bangkok): 12:00 & 20:30
 * - Seoul (UTC+9, Asia/Seoul): 12:00 & 19:00
 * - Singapore (UTC+8, Asia/Singapore): 12:30 & 20:00
 *
 * Layer: Tree (pure domain logic, algorithms without side effects)
 * Dependencies: imports only seed
 *
 * @module tree/publishing/apac-peak-optimizer
 */

export * from './apac';
