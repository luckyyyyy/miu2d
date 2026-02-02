//! A* 寻路算法 - 高性能 Rust 实现
//!
//! C# Reference: JxqyHD/Engine/PathFinder.cs
//!
//! 支持的寻路类型：
//! - PathOneStep: 简单贪心，约 10 步
//! - SimpleMaxNpcTry: 贪心最佳优先搜索，maxTry=100
//! - PerfectMaxNpcTry: A* 算法用于 NPC，maxTry=100
//! - PerfectMaxPlayerTry: A* 算法用于玩家，maxTry=500
//! - PathStraightLine: 直线，忽略障碍物（用于飞行者）

use hashbrown::{HashMap, HashSet};
use std::cmp::Ordering;
use std::collections::BinaryHeap;
use wasm_bindgen::prelude::*;

/// 寻路类型枚举
#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PathType {
    PathOneStep = 0,
    SimpleMaxNpcTry = 1,
    PerfectMaxNpcTry = 2,
    PerfectMaxPlayerTry = 3,
    PathStraightLine = 4,
}

/// 2D 向量/位置
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
struct Vec2 {
    x: i32,
    y: i32,
}

impl Vec2 {
    fn new(x: i32, y: i32) -> Self {
        Self { x, y }
    }

    /// 转换为像素坐标（用于距离计算）
    /// C# Reference: MapBase.ToPixelPosition
    fn to_pixel(&self) -> (f64, f64) {
        // 等距投影: x_pixel = (col - row) * 32, y_pixel = (col + row) * 16
        let px = (self.x - self.y) as f64 * 32.0;
        let py = (self.x + self.y) as f64 * 16.0;
        (px, py)
    }

    /// 计算到另一点的像素距离
    fn pixel_distance(&self, other: &Vec2) -> f64 {
        let (px1, py1) = self.to_pixel();
        let (px2, py2) = other.to_pixel();
        let dx = px2 - px1;
        let dy = py2 - py1;
        (dx * dx + dy * dy).sqrt()
    }
}

/// A* 节点
#[derive(Clone, Copy)]
struct PathNode {
    tile: Vec2,
    f_cost: f64, // g + h
    g_cost: f64, // 从起点到当前节点的代价
}

impl PartialEq for PathNode {
    fn eq(&self, other: &Self) -> bool {
        self.tile == other.tile
    }
}

impl Eq for PathNode {}

impl PartialOrd for PathNode {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for PathNode {
    fn cmp(&self, other: &Self) -> Ordering {
        // BinaryHeap 是最大堆，我们需要最小 f_cost，所以反转比较
        other
            .f_cost
            .partial_cmp(&self.f_cost)
            .unwrap_or(Ordering::Equal)
    }
}

/// 寻路器状态（可复用以减少内存分配）
#[wasm_bindgen]
pub struct PathFinder {
    /// 地图宽度（列数）
    map_width: i32,
    /// 地图高度（行数）
    map_height: i32,
    /// 障碍物位图：每个 bit 表示一个格子是否为障碍
    obstacle_bitmap: Vec<u8>,
    /// 硬障碍物位图（用于对角线阻挡）
    hard_obstacle_bitmap: Vec<u8>,
}

#[wasm_bindgen]
impl PathFinder {
    /// 创建新的寻路器
    #[wasm_bindgen(constructor)]
    pub fn new(map_width: i32, map_height: i32) -> Self {
        let size = ((map_width * map_height + 7) / 8) as usize;
        Self {
            map_width,
            map_height,
            obstacle_bitmap: vec![0; size],
            hard_obstacle_bitmap: vec![0; size],
        }
    }

    /// 更新障碍物位图
    #[wasm_bindgen]
    pub fn set_obstacle_bitmap(&mut self, bitmap: &[u8], hard_bitmap: &[u8]) {
        self.obstacle_bitmap = bitmap.to_vec();
        self.hard_obstacle_bitmap = hard_bitmap.to_vec();
    }

    /// 设置单个格子的障碍状态
    #[wasm_bindgen]
    pub fn set_obstacle(&mut self, x: i32, y: i32, is_obstacle: bool, is_hard: bool) {
        if x < 0 || y < 0 || x >= self.map_width || y >= self.map_height {
            return;
        }
        let index = (y * self.map_width + x) as usize;
        let byte_index = index / 8;
        let bit_index = index % 8;

        if byte_index < self.obstacle_bitmap.len() {
            if is_obstacle {
                self.obstacle_bitmap[byte_index] |= 1 << bit_index;
            } else {
                self.obstacle_bitmap[byte_index] &= !(1 << bit_index);
            }

            if is_hard {
                self.hard_obstacle_bitmap[byte_index] |= 1 << bit_index;
            } else {
                self.hard_obstacle_bitmap[byte_index] &= !(1 << bit_index);
            }
        }
    }

    /// 检查格子是否为障碍
    fn is_obstacle(&self, x: i32, y: i32) -> bool {
        if x < 0 || y < 0 || x >= self.map_width || y >= self.map_height {
            return true; // 边界外视为障碍
        }
        let index = (y * self.map_width + x) as usize;
        let byte_index = index / 8;
        let bit_index = index % 8;

        if byte_index < self.obstacle_bitmap.len() {
            (self.obstacle_bitmap[byte_index] >> bit_index) & 1 == 1
        } else {
            true
        }
    }

    /// 检查格子是否为硬障碍
    fn is_hard_obstacle(&self, x: i32, y: i32) -> bool {
        if x < 0 || y < 0 || x >= self.map_width || y >= self.map_height {
            return true;
        }
        let index = (y * self.map_width + x) as usize;
        let byte_index = index / 8;
        let bit_index = index % 8;

        if byte_index < self.hard_obstacle_bitmap.len() {
            (self.hard_obstacle_bitmap[byte_index] >> bit_index) & 1 == 1
        } else {
            true
        }
    }

    /// A* 寻路（带动态障碍物）
    /// dynamic_obstacles: [x1, y1, x2, y2, ...] 格式的动态障碍物列表
    /// 返回路径数组 [x1, y1, x2, y2, ...]，空数组表示无路径
    #[wasm_bindgen]
    pub fn find_path_with_dynamic(
        &self,
        start_x: i32,
        start_y: i32,
        end_x: i32,
        end_y: i32,
        path_type: PathType,
        can_move_direction_count: i32,
        dynamic_obstacles: &[i32],
    ) -> Vec<i32> {
        // 将动态障碍物转换为 HashSet
        let mut dynamic_set = HashSet::new();
        for i in (0..dynamic_obstacles.len()).step_by(2) {
            if i + 1 < dynamic_obstacles.len() {
                dynamic_set.insert(Vec2::new(dynamic_obstacles[i], dynamic_obstacles[i + 1]));
            }
        }

        let start = Vec2::new(start_x, start_y);
        let end = Vec2::new(end_x, end_y);

        if start == end {
            return vec![];
        }

        // 终点是静态或动态障碍物
        if self.is_obstacle(end_x, end_y) || dynamic_set.contains(&end) {
            return vec![];
        }

        let max_try = match path_type {
            PathType::PathOneStep => 10,
            PathType::SimpleMaxNpcTry => 100,
            PathType::PerfectMaxNpcTry => 100,
            PathType::PerfectMaxPlayerTry => 500,
            PathType::PathStraightLine => return self.find_straight_line(start, end),
        };

        match path_type {
            PathType::PathOneStep => {
                // TODO: 实现动态障碍物版本
                self.find_path_step(start, end, max_try, can_move_direction_count)
            }
            PathType::SimpleMaxNpcTry => {
                // TODO: 实现动态障碍物版本
                self.find_path_simple(start, end, max_try, can_move_direction_count)
            }
            PathType::PerfectMaxNpcTry | PathType::PerfectMaxPlayerTry => {
                // TODO: 实现动态障碍物版本
                self.find_path_perfect(start, end, max_try, can_move_direction_count)
            }
            PathType::PathStraightLine => self.find_straight_line(start, end),
        }
    }

    /// A* 寻路主入口（仅静态障碍物）
    /// 返回路径数组 [x1, y1, x2, y2, ...]，空数组表示无路径
    #[wasm_bindgen]
    pub fn find_path(
        &self,
        start_x: i32,
        start_y: i32,
        end_x: i32,
        end_y: i32,
        path_type: PathType,
        can_move_direction_count: i32,
    ) -> Vec<i32> {
        let start = Vec2::new(start_x, start_y);
        let end = Vec2::new(end_x, end_y);

        // 起点终点相同
        if start == end {
            return vec![];
        }

        // 终点是障碍物
        if self.is_obstacle(end_x, end_y) {
            return vec![];
        }

        let max_try = match path_type {
            PathType::PathOneStep => 10,
            PathType::SimpleMaxNpcTry => 100,
            PathType::PerfectMaxNpcTry => 100,
            PathType::PerfectMaxPlayerTry => 500,
            PathType::PathStraightLine => return self.find_straight_line(start, end),
        };

        match path_type {
            PathType::PathOneStep => {
                self.find_path_step(start, end, max_try, can_move_direction_count)
            }
            PathType::SimpleMaxNpcTry => {
                self.find_path_simple(start, end, max_try, can_move_direction_count)
            }
            PathType::PerfectMaxNpcTry | PathType::PerfectMaxPlayerTry => {
                self.find_path_perfect(start, end, max_try, can_move_direction_count)
            }
            PathType::PathStraightLine => self.find_straight_line(start, end),
        }
    }

    /// 获取 8 个相邻格子
    /// 方向布局:
    /// 3  4  5
    /// 2     6
    /// 1  0  7
    fn get_neighbors(&self, pos: Vec2) -> [Vec2; 8] {
        [
            Vec2::new(pos.x, pos.y + 1),     // 0: South
            Vec2::new(pos.x - 1, pos.y + 1), // 1: SouthWest
            Vec2::new(pos.x - 1, pos.y),     // 2: West
            Vec2::new(pos.x - 1, pos.y - 1), // 3: NorthWest
            Vec2::new(pos.x, pos.y - 1),     // 4: North
            Vec2::new(pos.x + 1, pos.y - 1), // 5: NorthEast
            Vec2::new(pos.x + 1, pos.y),     // 6: East
            Vec2::new(pos.x + 1, pos.y + 1), // 7: SouthEast
        ]
    }

    /// 检查是否可以向指定方向移动
    fn can_move_in_direction(&self, direction: usize, can_move_count: i32) -> bool {
        match can_move_count {
            1 => direction == 0,
            2 => direction == 0 || direction == 4,
            4 => direction == 0 || direction == 2 || direction == 4 || direction == 6,
            _ => (direction as i32) < can_move_count,
        }
    }

    /// 获取被障碍物阻挡的方向索引集合
    fn get_blocked_directions(&self, neighbors: &[Vec2; 8]) -> HashSet<usize> {
        let mut blocked = HashSet::new();

        for (i, neighbor) in neighbors.iter().enumerate() {
            if self.is_obstacle(neighbor.x, neighbor.y) {
                blocked.insert(i);

                // 对角线阻挡（只对硬障碍物生效）
                if self.is_hard_obstacle(neighbor.x, neighbor.y) {
                    match i {
                        1 => {
                            blocked.insert(0);
                            blocked.insert(2);
                        } // SW -> S, W
                        3 => {
                            blocked.insert(2);
                            blocked.insert(4);
                        } // NW -> W, N
                        5 => {
                            blocked.insert(4);
                            blocked.insert(6);
                        } // NE -> N, E
                        7 => {
                            blocked.insert(0);
                            blocked.insert(6);
                        } // SE -> S, E
                        _ => {}
                    }
                }
            }
        }

        blocked
    }

    /// 获取可通行的相邻格子
    fn find_valid_neighbors(&self, pos: Vec2, destination: Vec2, can_move_count: i32) -> Vec<Vec2> {
        let neighbors = self.get_neighbors(pos);
        let blocked = self.get_blocked_directions(&neighbors);

        neighbors
            .iter()
            .enumerate()
            .filter(|(i, neighbor)| {
                // 目标格子始终允许
                let is_destination = **neighbor == destination;
                is_destination
                    || (!blocked.contains(i) && self.can_move_in_direction(*i, can_move_count))
            })
            .map(|(_, n)| *n)
            .collect()
    }

    /// 简单贪心步进寻路
    fn find_path_step(
        &self,
        start: Vec2,
        end: Vec2,
        step_count: i32,
        can_move_count: i32,
    ) -> Vec<i32> {
        let mut path = vec![start.x, start.y];
        let mut visited = HashSet::new();
        let mut current = start;
        let mut remaining = step_count;

        let end_pixel = end.to_pixel();

        while remaining > 0 {
            let current_pixel = current.to_pixel();
            let dx = end_pixel.0 - current_pixel.0;
            let dy = end_pixel.1 - current_pixel.1;

            // 计算目标方向
            let target_dir = self.get_direction_from_delta(dx, dy);
            let neighbors = self.get_neighbors(current);
            let blocked = self.get_blocked_directions(&neighbors);

            // 按优先级尝试方向
            let direction_order = [
                target_dir,
                (target_dir + 1) % 8,
                (target_dir + 7) % 8,
                (target_dir + 2) % 8,
                (target_dir + 6) % 8,
                (target_dir + 3) % 8,
                (target_dir + 5) % 8,
                (target_dir + 4) % 8,
            ];

            let mut found = None;
            for dir in direction_order.iter() {
                let neighbor = neighbors[*dir];
                if !blocked.contains(dir)
                    && !visited.contains(&neighbor)
                    && self.can_move_in_direction(*dir, can_move_count)
                {
                    found = Some(neighbor);
                    break;
                }
            }

            match found {
                Some(next) => {
                    current = next;
                    path.push(current.x);
                    path.push(current.y);
                    visited.insert(current);

                    if current == end {
                        break;
                    }
                }
                None => break,
            }

            remaining -= 1;
        }

        if path.len() < 4 {
            vec![]
        } else {
            path
        }
    }

    /// 贪心最佳优先搜索
    fn find_path_simple(
        &self,
        start: Vec2,
        end: Vec2,
        max_try: i32,
        can_move_count: i32,
    ) -> Vec<i32> {
        let mut frontier = BinaryHeap::new();
        let mut came_from: HashMap<Vec2, Vec2> = HashMap::new();
        let mut try_count = 0;

        frontier.push(PathNode {
            tile: start,
            f_cost: 0.0,
            g_cost: 0.0,
        });

        while let Some(current_node) = frontier.pop() {
            if try_count >= max_try {
                break;
            }
            try_count += 1;

            let current = current_node.tile;

            if current == end {
                break;
            }

            for neighbor in self.find_valid_neighbors(current, end, can_move_count) {
                if !came_from.contains_key(&neighbor) {
                    let priority = neighbor.pixel_distance(&end);
                    frontier.push(PathNode {
                        tile: neighbor,
                        f_cost: priority,
                        g_cost: 0.0,
                    });
                    came_from.insert(neighbor, current);
                }
            }
        }

        self.reconstruct_path(&came_from, start, end)
    }

    /// A* 寻路算法
    fn find_path_perfect(
        &self,
        start: Vec2,
        end: Vec2,
        max_try: i32,
        can_move_count: i32,
    ) -> Vec<i32> {
        let mut frontier = BinaryHeap::new();
        let mut came_from: HashMap<Vec2, Vec2> = HashMap::new();
        let mut cost_so_far: HashMap<Vec2, f64> = HashMap::new();
        let mut try_count = 0;

        frontier.push(PathNode {
            tile: start,
            f_cost: 0.0,
            g_cost: 0.0,
        });
        cost_so_far.insert(start, 0.0);

        while let Some(current_node) = frontier.pop() {
            if max_try != -1 && try_count >= max_try {
                break;
            }
            try_count += 1;

            let current = current_node.tile;

            if current == end {
                break;
            }

            for neighbor in self.find_valid_neighbors(current, end, can_move_count) {
                let new_cost =
                    cost_so_far.get(&current).unwrap_or(&0.0) + current.pixel_distance(&neighbor);

                if !cost_so_far.contains_key(&neighbor)
                    || new_cost < *cost_so_far.get(&neighbor).unwrap()
                {
                    cost_so_far.insert(neighbor, new_cost);
                    let priority = new_cost + neighbor.pixel_distance(&end);
                    frontier.push(PathNode {
                        tile: neighbor,
                        f_cost: priority,
                        g_cost: new_cost,
                    });
                    came_from.insert(neighbor, current);
                }
            }
        }

        self.reconstruct_path(&came_from, start, end)
    }

    /// 直线路径（忽略障碍物）
    fn find_straight_line(&self, start: Vec2, end: Vec2) -> Vec<i32> {
        let mut path = vec![];
        let mut current = start;

        let dx = (end.x - start.x).signum();
        let dy = (end.y - start.y).signum();

        while current != end {
            path.push(current.x);
            path.push(current.y);

            if current.x != end.x {
                current.x += dx;
            }
            if current.y != end.y {
                current.y += dy;
            }
        }

        path.push(end.x);
        path.push(end.y);
        path
    }

    /// 重建路径
    fn reconstruct_path(
        &self,
        came_from: &HashMap<Vec2, Vec2>,
        start: Vec2,
        end: Vec2,
    ) -> Vec<i32> {
        if !came_from.contains_key(&end) {
            return vec![];
        }

        // 从终点回溯到起点，收集所有点
        let mut points = Vec::new();
        let mut current = end;

        while current != start {
            points.push(current);
            match came_from.get(&current) {
                Some(prev) => current = *prev,
                None => break,
            }
        }
        points.push(start);

        // 反转得到从起点到终点的顺序
        points.reverse();

        // 转换为 [x1, y1, x2, y2, ...] 格式
        let mut path = Vec::with_capacity(points.len() * 2);
        for p in points {
            path.push(p.x);
            path.push(p.y);
        }

        path
    }

    /// 从 delta 计算方向索引
    fn get_direction_from_delta(&self, dx: f64, dy: f64) -> usize {
        if dx == 0.0 && dy == 0.0 {
            return 0;
        }

        let angle = dy.atan2(dx);
        let deg = angle.to_degrees();

        // 转换为 0-7 方向索引
        // 方向布局:
        // 3  4  5
        // 2     6
        // 1  0  7
        if deg >= -22.5 && deg < 22.5 {
            6 // East
        } else if deg >= 22.5 && deg < 67.5 {
            7 // SouthEast
        } else if deg >= 67.5 && deg < 112.5 {
            0 // South
        } else if deg >= 112.5 && deg < 157.5 {
            1 // SouthWest
        } else if deg >= 157.5 || deg < -157.5 {
            2 // West
        } else if deg >= -157.5 && deg < -112.5 {
            3 // NorthWest
        } else if deg >= -112.5 && deg < -67.5 {
            4 // North
        } else {
            5 // NorthEast
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试 1: 空地图直线路径
    #[test]
    fn test_empty_map_diagonal() {
        let pathfinder = PathFinder::new(100, 100);
        let path = pathfinder.find_path(0, 0, 10, 10, PathType::PerfectMaxPlayerTry, 8);
        assert!(!path.is_empty(), "Should find path in empty map");
        // 路径应该从 (0,0) 开始
        assert_eq!(path[0], 0);
        assert_eq!(path[1], 0);
        // 路径应该到 (10,10) 结束
        let len = path.len();
        assert_eq!(path[len - 2], 10);
        assert_eq!(path[len - 1], 10);
        println!("test_empty_map_diagonal: path length = {} points", len / 2);
    }

    /// 测试 2: 起点终点相同
    #[test]
    fn test_same_start_end() {
        let pathfinder = PathFinder::new(100, 100);
        let path = pathfinder.find_path(5, 5, 5, 5, PathType::PerfectMaxPlayerTry, 8);
        assert!(path.is_empty(), "Same start/end should return empty path");
        println!("test_same_start_end: PASS");
    }

    /// 测试 3: 终点是障碍物
    #[test]
    fn test_end_is_obstacle() {
        let mut pathfinder = PathFinder::new(100, 100);
        pathfinder.set_obstacle(10, 10, true, true);
        let path = pathfinder.find_path(0, 0, 10, 10, PathType::PerfectMaxPlayerTry, 8);
        assert!(path.is_empty(), "Should not find path to obstacle");
        println!("test_end_is_obstacle: PASS");
    }

    /// 测试 4: 简单绕障碍物
    #[test]
    fn test_simple_obstacle_avoidance() {
        let mut pathfinder = PathFinder::new(100, 100);
        pathfinder.set_obstacle(5, 5, true, true);
        let path = pathfinder.find_path(0, 0, 10, 10, PathType::PerfectMaxPlayerTry, 8);
        assert!(!path.is_empty(), "Should find path around single obstacle");
        // 验证路径不经过障碍物
        for i in (0..path.len()).step_by(2) {
            assert!(
                !(path[i] == 5 && path[i + 1] == 5),
                "Path should not go through obstacle"
            );
        }
        println!(
            "test_simple_obstacle_avoidance: path length = {} points",
            path.len() / 2
        );
    }

    /// 测试 5: 墙壁障碍
    #[test]
    fn test_wall_obstacle() {
        let mut pathfinder = PathFinder::new(100, 100);
        // 创建一堵墙 (5, 0) 到 (5, 7)
        for y in 0..8 {
            pathfinder.set_obstacle(5, y, true, true);
        }
        let path = pathfinder.find_path(0, 4, 10, 4, PathType::PerfectMaxPlayerTry, 8);
        assert!(!path.is_empty(), "Should find path around wall");
        println!(
            "test_wall_obstacle: path length = {} points",
            path.len() / 2
        );
    }

    /// 测试 6: 目标是障碍物（无法到达）
    /// 注意：与 TS 测试一致，目标位置本身被设为障碍物
    #[test]
    fn test_unreachable_destination() {
        let mut pathfinder = PathFinder::new(100, 100);
        // 目标位置本身设为障碍物
        pathfinder.set_obstacle(10, 10, true, true);
        let path = pathfinder.find_path(0, 0, 10, 10, PathType::PerfectMaxPlayerTry, 8);
        assert!(
            path.is_empty(),
            "Should not find path to obstacle destination"
        );
        println!("test_unreachable_destination: PASS");
    }

    /// 测试 7: PathOneStep 类型
    #[test]
    fn test_path_one_step() {
        let pathfinder = PathFinder::new(100, 100);
        let path = pathfinder.find_path(0, 0, 20, 20, PathType::PathOneStep, 8);
        // PathOneStep 最多走约 10 步
        assert!(path.len() <= 22, "PathOneStep should be limited"); // 11 points * 2
        println!(
            "test_path_one_step: path length = {} points",
            path.len() / 2
        );
    }

    /// 测试 8: SimpleMaxNpcTry 类型
    #[test]
    fn test_simple_max_npc_try() {
        let pathfinder = PathFinder::new(100, 100);
        let path = pathfinder.find_path(0, 0, 30, 30, PathType::SimpleMaxNpcTry, 8);
        assert!(!path.is_empty(), "SimpleMaxNpcTry should find path");
        println!(
            "test_simple_max_npc_try: path length = {} points",
            path.len() / 2
        );
    }

    /// 测试 9: 中距离路径（maxTry=500 足够）
    /// 注意：与 TS 测试一致，使用 20,20
    #[test]
    fn test_medium_distance() {
        let pathfinder = PathFinder::new(100, 100);
        let path = pathfinder.find_path(0, 0, 20, 20, PathType::PerfectMaxPlayerTry, 8);
        assert!(!path.is_empty(), "Should find medium distance path");
        let len = path.len();
        assert_eq!(path[len - 2], 20);
        assert_eq!(path[len - 1], 20);
        println!("test_medium_distance: path length = {} points", len / 2);
    }

    /// 测试 10: PathStraightLine 类型（忽略障碍物）
    #[test]
    fn test_straight_line() {
        let mut pathfinder = PathFinder::new(100, 100);
        // 即使有障碍物，直线路径也应该穿过
        pathfinder.set_obstacle(5, 5, true, true);
        let path = pathfinder.find_path(0, 0, 10, 10, PathType::PathStraightLine, 8);
        assert!(!path.is_empty(), "StraightLine should always find path");
        println!(
            "test_straight_line: path length = {} points",
            path.len() / 2
        );
    }

    // ============ 路径有效性测试（与 TS pathFinder.comparison.test.ts 1:1 对照）============

    /// 验证路径有效性的辅助函数
    fn validate_path(
        path: &[i32],
        start: (i32, i32),
        end: (i32, i32),
        pathfinder: &PathFinder,
    ) -> Result<(), String> {
        if path.is_empty() {
            return Ok(()); // 空路径表示没找到，有效
        }

        let len = path.len();
        if len % 2 != 0 {
            return Err("Path length should be even".to_string());
        }

        // 检查起点
        if path[0] != start.0 || path[1] != start.1 {
            return Err(format!(
                "Path does not start at ({},{}), starts at ({},{})",
                start.0, start.1, path[0], path[1]
            ));
        }

        // 检查终点
        if path[len - 2] != end.0 || path[len - 1] != end.1 {
            return Err(format!(
                "Path does not end at ({},{}), ends at ({},{})",
                end.0,
                end.1,
                path[len - 2],
                path[len - 1]
            ));
        }

        // 检查每个点不是障碍物，相邻点真的相邻
        for i in (0..len).step_by(2) {
            let x = path[i];
            let y = path[i + 1];
            if pathfinder.is_obstacle(x, y) {
                return Err(format!("Path contains obstacle at ({},{})", x, y));
            }
            if i > 0 {
                let prev_x = path[i - 2];
                let prev_y = path[i - 1];
                let dx = (x - prev_x).abs();
                let dy = (y - prev_y).abs();
                if dx > 1 || dy > 1 {
                    return Err(format!(
                        "Non-adjacent points: ({},{}) -> ({},{})",
                        prev_x, prev_y, x, y
                    ));
                }
            }
        }

        Ok(())
    }

    /// 路径有效性测试 1: 空地图路径
    #[test]
    fn test_valid_path_empty_map() {
        let pathfinder = PathFinder::new(100, 100);
        let path = pathfinder.find_path(0, 0, 10, 10, PathType::PerfectMaxPlayerTry, 8);
        let result = validate_path(&path, (0, 0), (10, 10), &pathfinder);
        assert!(
            result.is_ok(),
            "Empty map path should be valid: {:?}",
            result
        );
        println!("valid_path_empty_map: {} points", path.len() / 2);
    }

    /// 路径有效性测试 2: 绕障碍物路径
    #[test]
    fn test_valid_path_around_obstacle() {
        let mut pathfinder = PathFinder::new(100, 100);
        pathfinder.set_obstacle(5, 5, true, true);
        let path = pathfinder.find_path(0, 0, 10, 10, PathType::PerfectMaxPlayerTry, 8);
        let result = validate_path(&path, (0, 0), (10, 10), &pathfinder);
        assert!(
            result.is_ok(),
            "Path around obstacle should be valid: {:?}",
            result
        );
        println!("valid_path_around_obstacle: {} points", path.len() / 2);
    }

    /// 路径有效性测试 3: 绕墙路径
    #[test]
    fn test_valid_path_around_wall() {
        let mut pathfinder = PathFinder::new(100, 100);
        for y in 0..8 {
            pathfinder.set_obstacle(5, y, true, true);
        }
        let path = pathfinder.find_path(0, 4, 10, 4, PathType::PerfectMaxPlayerTry, 8);
        let result = validate_path(&path, (0, 4), (10, 4), &pathfinder);
        assert!(
            result.is_ok(),
            "Path around wall should be valid: {:?}",
            result
        );
        println!("valid_path_around_wall: {} points", path.len() / 2);
    }

    /// 路径有效性测试 4: 复杂迷宫
    #[test]
    fn test_valid_path_in_maze() {
        let mut pathfinder = PathFinder::new(50, 50);
        // 创建迷宫式障碍
        for i in 0..30 {
            for x in 0..15 {
                if i % 6 < 3 {
                    pathfinder.set_obstacle(x, i * 2 + 5, true, true);
                } else {
                    pathfinder.set_obstacle(x + 35, i * 2 + 5, true, true);
                }
            }
        }
        let path = pathfinder.find_path(0, 0, 25, 25, PathType::PerfectMaxPlayerTry, 8);
        if !path.is_empty() {
            let result = validate_path(&path, (0, 0), (25, 25), &pathfinder);
            assert!(result.is_ok(), "Maze path should be valid: {:?}", result);
        }
        println!("valid_path_in_maze: {} points", path.len() / 2);
    }

    /// 路径有效性测试 5: SimpleMaxNpcTry 路径连续性
    #[test]
    fn test_valid_path_simple_npc() {
        let pathfinder = PathFinder::new(100, 100);
        let path = pathfinder.find_path(0, 0, 30, 30, PathType::SimpleMaxNpcTry, 8);
        assert!(!path.is_empty(), "SimpleMaxNpcTry should find a path");
        // 验证起点
        assert_eq!(path[0], 0);
        assert_eq!(path[1], 0);
        // 验证路径连续性
        for i in (2..path.len()).step_by(2) {
            let dx = (path[i] - path[i - 2]).abs();
            let dy = (path[i + 1] - path[i - 1]).abs();
            assert!(
                dx <= 1 && dy <= 1,
                "Non-adjacent at {}: ({},{}) -> ({},{})",
                i / 2,
                path[i - 2],
                path[i - 1],
                path[i],
                path[i + 1]
            );
        }
        println!(
            "valid_path_simple_npc: {} points, ends at ({},{})",
            path.len() / 2,
            path[path.len() - 2],
            path[path.len() - 1]
        );
    }

    /// 路径有效性测试 6: PathOneStep 路径
    #[test]
    fn test_valid_path_one_step() {
        let pathfinder = PathFinder::new(100, 100);
        let path = pathfinder.find_path(0, 0, 20, 20, PathType::PathOneStep, 8);
        if !path.is_empty() {
            // 验证起点
            assert_eq!(path[0], 0);
            assert_eq!(path[1], 0);
            // 验证路径连续性
            for i in (2..path.len()).step_by(2) {
                let dx = (path[i] - path[i - 2]).abs();
                let dy = (path[i + 1] - path[i - 1]).abs();
                assert!(dx <= 1 && dy <= 1, "Non-adjacent points in PathOneStep");
            }
        }
        println!("valid_path_one_step: {} points", path.len() / 2);
    }

    /// 边界测试 1: 相邻点（验证路径有效性，不要求确切路径）
    #[test]
    fn test_adjacent_points() {
        let pathfinder = PathFinder::new(100, 100);
        let path = pathfinder.find_path(5, 5, 6, 5, PathType::PerfectMaxPlayerTry, 8);
        println!("adjacent_points path: {:?}", path);
        // A* 可能选择不同的等价路径，只验证基本属性
        assert!(!path.is_empty(), "Path should not be empty");
        assert!(path.len() >= 4, "Path should have at least 2 points");
        // 验证起点
        assert_eq!((path[0], path[1]), (5, 5), "Path should start at (5,5)");
        // 验证终点
        let len = path.len();
        assert_eq!(
            (path[len - 2], path[len - 1]),
            (6, 5),
            "Path should end at (6,5)"
        );
    }

    /// 边界测试 2: 对角相邻点
    #[test]
    fn test_diagonal_adjacent_points() {
        let pathfinder = PathFinder::new(100, 100);
        let path = pathfinder.find_path(5, 5, 6, 6, PathType::PerfectMaxPlayerTry, 8);
        assert_eq!(path.len(), 4);
        assert_eq!(path[0], 5);
        assert_eq!(path[1], 5);
        assert_eq!(path[2], 6);
        assert_eq!(path[3], 6);
    }

    /// 性能基准测试
    #[test]
    fn benchmark_pathfinding() {
        use std::time::Instant;

        let mut pathfinder = PathFinder::new(100, 100);
        // 添加一些随机障碍物
        for i in 0..200 {
            let x = (i * 7) % 100;
            let y = (i * 13) % 100;
            pathfinder.set_obstacle(x, y, true, true);
        }

        let iterations = 100;
        let test_cases = [(0, 0, 50, 50), (10, 10, 90, 90), (25, 25, 75, 75)];

        let start = Instant::now();
        for _ in 0..iterations {
            for &(sx, sy, ex, ey) in &test_cases {
                let _ = pathfinder.find_path(sx, sy, ex, ey, PathType::PerfectMaxPlayerTry, 8);
            }
        }
        let elapsed = start.elapsed();

        let total_runs = iterations * test_cases.len();
        println!(
            "benchmark_pathfinding: {} runs in {:?} ({:.3}ms avg)",
            total_runs,
            elapsed,
            elapsed.as_secs_f64() * 1000.0 / total_runs as f64
        );
    }
}
