# app.py - 最終完整版 (含評論系統)
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
import random
import time
from datetime import datetime

# === 1. 設定日誌與伺服器 ===
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# === 2. 初始化 Firebase ===
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# === Helper ===
def fetch_all_books_from_db():
    try:
        docs = db.collection('books').stream()
        return [{**doc.to_dict(), 'id': doc.id} for doc in docs]
    except Exception as e:
        logging.error(f"讀取資料庫失敗: {e}")
        return []

# === 新增：首頁路由 (加在 API 1 之前) ===
@app.route('/')
def home():
    return app.send_static_file('index.html')

# === API 1: 取得書籍列表 ===
@app.route('/api/books', methods=['GET'])
def get_books():
    start_time = time.time()
    limit = request.args.get('limit', default=100, type=int)
    all_books = fetch_all_books_from_db()
    response_books = all_books[:limit]
    
    logging.info(f"[API] 取得書籍 - 數量: {len(response_books)} - 耗時: {time.time()-start_time:.4f}s")
    return jsonify(response_books), 200

# === API 2: 後端搜尋 ===
@app.route('/api/search', methods=['GET'])
def search_books():
    keyword = request.args.get('q', '').lower()
    logging.info(f"[Search] 搜尋關鍵字: '{keyword}'")
    all_books = fetch_all_books_from_db()
    results = [b for b in all_books if keyword in b.get('title', '').lower() or keyword in b.get('author', '').lower()]
    return jsonify(results), 200

# === API 3: 智慧推薦 ===
@app.route('/api/recommendations', methods=['GET'])
def get_recommendations():
    all_books = fetch_all_books_from_db()
    
    # === 修改開始：安全過濾高分書籍 ===
    high_rated = []
    for b in all_books:
        try:
            # 強制將 rating 轉為浮點數 (float)
            # 如果資料庫裡是字串 "4.8"，這裡會變成數字 4.8
            rating = float(b.get('rating', 0))
            if rating >= 4.5:
                high_rated.append(b)
        except (ValueError, TypeError):
            # 如果 rating 是 "N/A" 或奇怪的文字，就跳過這本書，防止當機
            continue
    # === 修改結束 ===

    selected = random.sample(high_rated, 3) if len(high_rated) > 3 else high_rated
    return jsonify(selected), 200

# === API 4: 取得某本書的評論 (新功能) ===
@app.route('/api/reviews', methods=['GET'])
def get_reviews():
    book_id = request.args.get('bookId')
    try:
        # 從 Firebase 'reviews' 集合中找對應 bookId 的留言
        reviews_ref = db.collection('reviews').where('bookId', '==', str(book_id)).stream()
        reviews = [doc.to_dict() for doc in reviews_ref]
        # 按時間倒序排列 (最新的在上面)
        reviews.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        return jsonify(reviews), 200
    except Exception as e:
        logging.error(f"讀取評論失敗: {e}")
        return jsonify([]), 500

# === API 5: 新增評論 (新功能) ===
@app.route('/api/reviews', methods=['POST'])
def add_review():
    data = request.json
    # data 包含: bookId, user, content, rating
    data['timestamp'] = datetime.now().isoformat() # 加上伺服器時間
    
    db.collection('reviews').add(data)
    
    logging.info(f"[Review] 用戶 {data.get('user')} 評論了書籍 {data.get('bookId')}")
    return jsonify({"success": True}), 200

if __name__ == '__main__':
    logging.info("🔥 ReadWise 全端伺服器 (含評論系統) 啟動中...")

    app.run(debug=True, port=5000)



