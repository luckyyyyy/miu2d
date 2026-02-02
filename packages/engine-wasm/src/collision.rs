//! 空间碰撞检测 - 高性能 Rust 实现
//!
//! 使用空间哈希网格进行快速碰撞查询
//! 适用于大量移动实体的碰撞检测场景

use hashbrown::{HashMap, HashSet};
use wasm_bindgen::prelude::*;

/// 实体数据
#[derive(Clone, Copy, Debug)]
struct Entity {
    id: u32,
    x: f32,
    y: f32,
    radius: f32,
    group: u32, // 用于区分敌我阵营
}

/// 空间哈希网格
#[wasm_bindgen]
pub struct SpatialHash {
    /// 网格单元大小
    cell_size: f32,
    /// 网格数据: cell_key -> entity_ids
    grid: HashMap<(i32, i32), Vec<u32>>,
    /// 实体数据
    entities: HashMap<u32, Entity>,
}

#[wasm_bindgen]
impl SpatialHash {
    /// 创建新的空间哈希
    #[wasm_bindgen(constructor)]
    pub fn new(cell_size: f32) -> Self {
        Self {
            cell_size: cell_size.max(1.0),
            grid: HashMap::new(),
            entities: HashMap::new(),
        }
    }

    /// 清空所有数据
    #[wasm_bindgen]
    pub fn clear(&mut self) {
        self.grid.clear();
        self.entities.clear();
    }

    /// 添加或更新实体
    #[wasm_bindgen]
    pub fn upsert(&mut self, id: u32, x: f32, y: f32, radius: f32, group: u32) {
        // 如果实体已存在，先移除旧位置
        if let Some(old_entity) = self.entities.get(&id) {
            let old_cell = self.get_cell(old_entity.x, old_entity.y);
            if let Some(cell_entities) = self.grid.get_mut(&old_cell) {
                cell_entities.retain(|&eid| eid != id);
            }
        }

        // 更新实体数据
        let entity = Entity {
            id,
            x,
            y,
            radius,
            group,
        };
        self.entities.insert(id, entity);

        // 添加到新网格单元
        let cell = self.get_cell(x, y);
        self.grid.entry(cell).or_default().push(id);
    }

    /// 移除实体
    #[wasm_bindgen]
    pub fn remove(&mut self, id: u32) {
        if let Some(entity) = self.entities.remove(&id) {
            let cell = self.get_cell(entity.x, entity.y);
            if let Some(cell_entities) = self.grid.get_mut(&cell) {
                cell_entities.retain(|&eid| eid != id);
            }
        }
    }

    /// 批量更新实体位置
    /// positions: [id1, x1, y1, id2, x2, y2, ...]
    #[wasm_bindgen]
    pub fn batch_update_positions(&mut self, positions: &[f32]) {
        let chunk_size = 3;
        for chunk in positions.chunks(chunk_size) {
            if chunk.len() >= 3 {
                let id = chunk[0] as u32;
                let x = chunk[1];
                let y = chunk[2];

                // 先获取旧位置信息
                let old_info = self.entities.get(&id).map(|e| (e.x, e.y));

                if let Some((old_x, old_y)) = old_info {
                    // 移除旧位置
                    let old_cell = self.get_cell(old_x, old_y);
                    if let Some(cell_entities) = self.grid.get_mut(&old_cell) {
                        cell_entities.retain(|&eid| eid != id);
                    }

                    // 更新位置
                    if let Some(entity) = self.entities.get_mut(&id) {
                        entity.x = x;
                        entity.y = y;
                    }

                    // 添加到新位置
                    let new_cell = self.get_cell(x, y);
                    self.grid.entry(new_cell).or_default().push(id);
                }
            }
        }
    }

    /// 查询圆形范围内的所有实体
    /// 返回实体 ID 数组
    #[wasm_bindgen]
    pub fn query_radius(&self, x: f32, y: f32, radius: f32) -> Vec<u32> {
        let mut result = Vec::new();
        let cells = self.get_cells_in_radius(x, y, radius);

        for cell in cells {
            if let Some(entity_ids) = self.grid.get(&cell) {
                for &id in entity_ids {
                    if let Some(entity) = self.entities.get(&id) {
                        let dx = entity.x - x;
                        let dy = entity.y - y;
                        let dist_sq = dx * dx + dy * dy;
                        let combined_radius = radius + entity.radius;

                        if dist_sq <= combined_radius * combined_radius {
                            result.push(id);
                        }
                    }
                }
            }
        }

        result
    }

    /// 查询指定位置的实体（精确匹配网格单元）
    #[wasm_bindgen]
    pub fn query_at(&self, x: f32, y: f32) -> Vec<u32> {
        let cell = self.get_cell(x, y);
        self.grid.get(&cell).cloned().unwrap_or_default()
    }

    /// 查询指定位置特定阵营的实体
    #[wasm_bindgen]
    pub fn query_at_by_group(&self, x: f32, y: f32, group: u32) -> Vec<u32> {
        let cell = self.get_cell(x, y);
        if let Some(entity_ids) = self.grid.get(&cell) {
            entity_ids
                .iter()
                .filter(|&&id| {
                    self.entities
                        .get(&id)
                        .map(|e| e.group == group)
                        .unwrap_or(false)
                })
                .copied()
                .collect()
        } else {
            Vec::new()
        }
    }

    /// 查询指定位置非指定阵营的实体（用于敌我识别）
    #[wasm_bindgen]
    pub fn query_at_excluding_group(&self, x: f32, y: f32, exclude_group: u32) -> Vec<u32> {
        let cell = self.get_cell(x, y);
        if let Some(entity_ids) = self.grid.get(&cell) {
            entity_ids
                .iter()
                .filter(|&&id| {
                    self.entities
                        .get(&id)
                        .map(|e| e.group != exclude_group)
                        .unwrap_or(false)
                })
                .copied()
                .collect()
        } else {
            Vec::new()
        }
    }

    /// 检测所有碰撞对
    /// 返回碰撞对数组 [id1, id2, id3, id4, ...]
    #[wasm_bindgen]
    pub fn detect_all_collisions(&self) -> Vec<u32> {
        let mut collisions = Vec::new();
        let mut checked = HashSet::new();

        for entity in self.entities.values() {
            let cells = self.get_cells_in_radius(entity.x, entity.y, entity.radius);

            for cell in cells {
                if let Some(entity_ids) = self.grid.get(&cell) {
                    for &other_id in entity_ids {
                        if entity.id >= other_id {
                            continue; // 避免重复检测
                        }

                        let pair = (entity.id.min(other_id), entity.id.max(other_id));
                        if checked.contains(&pair) {
                            continue;
                        }
                        checked.insert(pair);

                        if let Some(other) = self.entities.get(&other_id) {
                            let dx = other.x - entity.x;
                            let dy = other.y - entity.y;
                            let dist_sq = dx * dx + dy * dy;
                            let combined_radius = entity.radius + other.radius;

                            if dist_sq <= combined_radius * combined_radius {
                                collisions.push(entity.id);
                                collisions.push(other_id);
                            }
                        }
                    }
                }
            }
        }

        collisions
    }

    /// 检测指定实体与其他实体的碰撞
    #[wasm_bindgen]
    pub fn detect_collisions_for(&self, id: u32) -> Vec<u32> {
        let Some(entity) = self.entities.get(&id) else {
            return Vec::new();
        };

        let mut collisions = Vec::new();
        let cells = self.get_cells_in_radius(entity.x, entity.y, entity.radius);

        for cell in cells {
            if let Some(entity_ids) = self.grid.get(&cell) {
                for &other_id in entity_ids {
                    if other_id == id {
                        continue;
                    }

                    if let Some(other) = self.entities.get(&other_id) {
                        let dx = other.x - entity.x;
                        let dy = other.y - entity.y;
                        let dist_sq = dx * dx + dy * dy;
                        let combined_radius = entity.radius + other.radius;

                        if dist_sq <= combined_radius * combined_radius {
                            collisions.push(other_id);
                        }
                    }
                }
            }
        }

        collisions
    }

    /// 获取实体数量
    #[wasm_bindgen]
    pub fn count(&self) -> u32 {
        self.entities.len() as u32
    }

    /// 获取位置所在的网格单元
    #[inline]
    fn get_cell(&self, x: f32, y: f32) -> (i32, i32) {
        (
            (x / self.cell_size).floor() as i32,
            (y / self.cell_size).floor() as i32,
        )
    }

    /// 获取圆形范围覆盖的所有网格单元
    fn get_cells_in_radius(&self, x: f32, y: f32, radius: f32) -> Vec<(i32, i32)> {
        let min_cell = self.get_cell(x - radius, y - radius);
        let max_cell = self.get_cell(x + radius, y + radius);

        let mut cells = Vec::new();
        for cx in min_cell.0..=max_cell.0 {
            for cy in min_cell.1..=max_cell.1 {
                cells.push((cx, cy));
            }
        }
        cells
    }
}

/// 矩形碰撞检测（AABB）
#[wasm_bindgen]
pub fn check_aabb_collision(
    x1: f32,
    y1: f32,
    w1: f32,
    h1: f32,
    x2: f32,
    y2: f32,
    w2: f32,
    h2: f32,
) -> bool {
    x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2
}

/// 圆形碰撞检测
#[wasm_bindgen]
pub fn check_circle_collision(x1: f32, y1: f32, r1: f32, x2: f32, y2: f32, r2: f32) -> bool {
    let dx = x2 - x1;
    let dy = y2 - y1;
    let dist_sq = dx * dx + dy * dy;
    let combined_radius = r1 + r2;
    dist_sq <= combined_radius * combined_radius
}

/// 点是否在矩形内
#[wasm_bindgen]
pub fn point_in_rect(px: f32, py: f32, rx: f32, ry: f32, rw: f32, rh: f32) -> bool {
    px >= rx && px <= rx + rw && py >= ry && py <= ry + rh
}

/// 点是否在圆内
#[wasm_bindgen]
pub fn point_in_circle(px: f32, py: f32, cx: f32, cy: f32, radius: f32) -> bool {
    let dx = px - cx;
    let dy = py - cy;
    dx * dx + dy * dy <= radius * radius
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spatial_hash_basic() {
        let mut hash = SpatialHash::new(64.0);
        hash.upsert(1, 100.0, 100.0, 16.0, 0);
        hash.upsert(2, 110.0, 100.0, 16.0, 0);

        let result = hash.query_radius(100.0, 100.0, 50.0);
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_collision_detection() {
        let mut hash = SpatialHash::new(64.0);
        hash.upsert(1, 100.0, 100.0, 16.0, 0);
        hash.upsert(2, 120.0, 100.0, 16.0, 0); // 重叠

        let collisions = hash.detect_all_collisions();
        assert_eq!(collisions.len(), 2);
    }

    #[test]
    fn test_aabb_collision() {
        assert!(check_aabb_collision(
            0.0, 0.0, 10.0, 10.0, 5.0, 5.0, 10.0, 10.0
        ));
        assert!(!check_aabb_collision(
            0.0, 0.0, 10.0, 10.0, 20.0, 20.0, 10.0, 10.0
        ));
    }

    #[test]
    fn test_circle_collision() {
        assert!(check_circle_collision(0.0, 0.0, 10.0, 15.0, 0.0, 10.0));
        assert!(!check_circle_collision(0.0, 0.0, 10.0, 30.0, 0.0, 10.0));
    }
}
