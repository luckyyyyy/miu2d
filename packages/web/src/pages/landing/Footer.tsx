/**
 * Footer - 页脚
 */

import { GitHubIcon } from "@miu2d/ui";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

const GAMES = [
  { slug: "demo", name: "月影传说" },
  { slug: "sword1", name: "新剑侠情缘" },
  { slug: "sword2", name: "剑侠情缘2" },
] as const;

function GameFooterLink({ slug, name }: { slug: string; name: string }) {
  return (
    <li>
      <a
        href={`/game/${slug}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors group"
      >
        <img
          src={`/game/${slug}/api/logo`}
          alt={name}
          className="w-5 h-5 rounded object-cover ring-1 ring-zinc-200 dark:ring-zinc-700 group-hover:ring-orange-400 transition-all flex-shrink-0"
        />
        {name}
      </a>
    </li>
  );
}

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="relative py-12 overflow-hidden border-t border-zinc-200 dark:border-zinc-800">
      {/* 背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
          {/* 品牌区 */}
          <div className="md:col-span-1">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent"
            >
              <span className="text-2xl">⚡</span>
              Miu2D Engine
            </motion.div>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{t("footer.tagline")}</p>
            <div className="mt-5">
              <motion.a
                href="https://github.com/luckyyyyy/miu2d"
                target="_blank"
                rel="noreferrer"
                whileHover={{ scale: 1.05 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <GitHubIcon className="w-4 h-4" />
                GitHub
              </motion.a>
            </div>
          </div>

          {/* 游戏列 */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
              {t("nav.games")}
            </h4>
            <ul className="mt-4 space-y-3">
              {GAMES.map((g) => (
                <GameFooterLink key={g.slug} slug={g.slug} name={g.name} />
              ))}
            </ul>
          </div>

          {/* 导航列 */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
              {t("footer.about")}
            </h4>
            <ul className="mt-4 space-y-3">
              <li>
                <a
                  href="#features"
                  className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  {t("nav.features")}
                </a>
              </li>
              <li>
                <a
                  href="#demo"
                  className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  {t("nav.demo")}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* 版权 */}
        <div className="mt-10 pt-8 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("footer.copyright")}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Made with ❤️ and AI ✨</p>
        </div>
      </div>
    </footer>
  );
}
