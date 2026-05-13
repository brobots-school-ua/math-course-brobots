'use client'

export default function OfflineModule0() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg border p-8 max-w-md w-full text-center">
        <div className="text-4xl mb-4">📄</div>
        <h1 className="text-xl font-bold mb-2">Офлайн-завдання · Модуль 0</h1>
        <p className="text-gray-500 text-sm mb-6">
          Завантаж бланк, роздрукуй, виконай від руки і здай фото через урок.
        </p>
        <a
          href="/offline/module-0.pdf"
          download
          className="block bg-blue-600 text-white rounded-lg px-6 py-3 hover:bg-blue-700 font-medium mb-3"
        >
          ⬇ Завантажити PDF
        </a>
        <a
          href="/offline/module-0.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-white border border-gray-300 text-gray-700 rounded-lg px-6 py-3 hover:bg-gray-50 font-medium text-sm"
        >
          🔍 Переглянути у браузері
        </a>
      </div>
    </div>
  )
}
