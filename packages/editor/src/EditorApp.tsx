import { Route, Routes } from "react-router-dom";
import { EditorLayout } from "./components/EditorLayout";
import { EditorHome } from "./editors/EditorHome";
import { AsfEditor } from "./editors/AsfEditor";
import { CharacterEditor } from "./editors/CharacterEditor";
import { MagicEditor } from "./editors/MagicEditor";
import { MapEditor } from "./editors/MapEditor";
import { ScriptEditor } from "./editors/ScriptEditor";

/**
 * 编辑器应用主组件
 * 在 /editor/* 路径下渲染
 */
export function EditorApp() {
  return (
    <Routes>
      <Route element={<EditorLayout />}>
        <Route index element={<EditorHome />} />
        <Route path="asf" element={<AsfEditor />} />
        <Route path="character" element={<CharacterEditor />} />
        <Route path="map" element={<MapEditor />} />
        <Route path="map/:mapId" element={<MapEditor />} />
        <Route path="script" element={<ScriptEditor />} />
        <Route path="script/*" element={<ScriptEditor />} />
        <Route path="magic" element={<MagicEditor />} />
        <Route path="magic/:magicId" element={<MagicEditor />} />
      </Route>
    </Routes>
  );
}
