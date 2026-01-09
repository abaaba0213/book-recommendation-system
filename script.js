// script.js - 最終美化版 (含精美圖片與評論功能)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, updateDoc, arrayUnion, arrayRemove, getDoc, collection, addDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBevMWhajxGSGgC95p7NXgfpbu5h_n1uJw",
  authDomain: "project-2765231464479629338.firebaseapp.com",
  projectId: "project-2765231464479629338",
  storageBucket: "project-2765231464479629338.firebasestorage.app",
  messagingSenderId: "845777744000",
  appId: "1:845777744000:web:f06a1d42a25496fbe3f665",
  measurementId: "G-VPS6QM28NR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); 
const provider = new GoogleAuthProvider();
const API_URL = "/api";

const appState = { books: [], user: null, likedBookIds: [], filter: 'all' };

// DOM 元素
const bookGrid = document.getElementById('book-grid');
const loadingEl = document.getElementById('loading');
const loginBtn = document.getElementById('login-btn');
const userInfoEl = document.getElementById('user-info');
const userNameEl = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');
const modal = document.getElementById('book-modal');
const closeModalBtn = document.querySelector('.close-modal');

// === 初始化 ===
async function init() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            appState.user = user;
            loginBtn.classList.add('hidden');
            userInfoEl.classList.remove('hidden');
            userNameEl.innerText = `Hi, ${user.displayName}`;
            await loadUserLikes();
        } else {
            appState.user = null;
            appState.likedBookIds = [];
            loginBtn.classList.remove('hidden');
            userInfoEl.classList.add('hidden');
        }
        renderBooks();
    });
    await fetchBooks();
    await fetchRecommendations();
}

async function fetchBooks() {
    try {
        const response = await fetch(`${API_URL}/books?limit=50`);
        if (!response.ok) throw new Error('API Error');
        appState.books = await response.json();
        renderBooks();
        loadingEl.classList.add('hidden');
    } catch (error) {
        console.error(error);
        loadingEl.innerText = "請啟動後端伺服器 (python app.py)";
    }
}

// === 核心：評論功能邏輯 ===
async function fetchReviews(bookId) {
    const listEl = document.getElementById('reviews-list');
    listEl.innerHTML = '<p style="color:#888; font-size:0.8rem;">載入評論中...</p>';
    
    try {
        const res = await fetch(`${API_URL}/reviews?bookId=${bookId}`);
        const reviews = await res.json();
        
        listEl.innerHTML = '';
        if (reviews.length === 0) {
            listEl.innerHTML = '<p style="color:#888; font-style:italic;">目前尚無評論，快來搶頭香！</p>';
            return;
        }
        
        reviews.forEach(r => {
            const date = new Date(r.timestamp).toLocaleDateString();
            const div = document.createElement('div');
            div.className = 'review-item';
            div.innerHTML = `
                <div class="review-header">
                    <span class="review-user">${r.user_name}</span>
                    <span>${date}</span>
                </div>
                <div class="review-content">${r.content}</div>
            `;
            listEl.appendChild(div);
        });
    } catch (e) {
        listEl.innerHTML = '無法載入評論';
    }
}

async function submitReview(bookId) {
    const input = document.getElementById('review-input');
    const content = input.value.trim();
    if (!content) return alert("請輸入內容");
    
    const btn = document.getElementById('submit-review-btn');
    btn.disabled = true;
    btn.innerText = "送出中...";

    try {
        await fetch(`${API_URL}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bookId: String(bookId),
                user_id: appState.user.uid,
                user_name: appState.user.displayName,
                content: content,
                rating: 5 
            })
        });
        input.value = '';
        await fetchReviews(bookId); 
    } catch (e) {
        alert("發布失敗");
    } finally {
        btn.disabled = false;
        btn.innerText = "送出評論";
    }
}

// === 搜尋與推薦 ===
let searchTimeout;
document.getElementById('searchInput').addEventListener('input', (e) => {
    const keyword = e.target.value.trim();
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        if (!keyword) { await fetchBooks(); return; }
        const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(keyword)}`);
        appState.books = await res.json();
        renderBooks();
    }, 500);
});

async function fetchRecommendations() {
    try {
        const res = await fetch(`${API_URL}/recommendations`);
        const data = await res.json();
        const container = document.getElementById('recommendation-container');
        container.innerHTML = '';
        data.forEach(book => container.appendChild(createBookCard(book)));
    } catch(e){}
}

// === UI 渲染 ===
function renderBooks() {
    let filtered = appState.books.filter(book => {
        if (appState.filter === 'favorites') return appState.likedBookIds.includes(book.id);
        return appState.filter === 'all' || book.category === appState.filter;
    });
    bookGrid.innerHTML = '';
    if (filtered.length === 0) document.getElementById('empty-state').classList.remove('hidden');
    else {
        document.getElementById('empty-state').classList.add('hidden');
        filtered.forEach(book => bookGrid.appendChild(createBookCard(book)));
    }
}

function createBookCard(book) {
    const card = document.createElement('article');
    card.className = 'book-card';
    const imgSrc = (book.image && book.image.startsWith('http')) ? book.image : 'https://placehold.co/300x450/EEE/31343C?text=No+Cover';
    const isLiked = appState.likedBookIds.includes(book.id);
    
    card.innerHTML = `
        <button class="card-like-btn ${isLiked?'liked':''}" data-id="${book.id}">${isLiked?'❤️':'🤍'}</button>
        <img src="${imgSrc}" class="book-image" loading="lazy">
        <div class="book-info">
            <span class="book-category">${book.category||'未分類'}</span>
            <h3 class="book-title">${book.title}</h3>
            <p class="book-author">${book.author}</p>
            <div class="book-rating">★ ${book.rating}</div>
        </div>`;
    
    card.querySelector('.card-like-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleLike(book.id, e.target); });
    card.addEventListener('click', () => openModal(book));
    return card;
}

// Modal
function openModal(book) {
    const modalImg = document.getElementById('modal-img');
    const likeBtn = document.getElementById('modal-like-btn');
    modalImg.src = (book.image && book.image.startsWith('http')) ? book.image : 'https://placehold.co/300x450/EEE/31343C?text=No+Cover';
    document.getElementById('modal-category').innerText = book.category;
    document.getElementById('modal-title').innerText = book.title;
    document.getElementById('modal-author').innerText = `作者：${book.author}`;
    document.getElementById('modal-rating').innerText = `★ ${book.rating}`;
    document.getElementById('modal-desc').innerText = book.description || '暫無簡介';
    document.getElementById('modal-tags').innerHTML = (book.tags||[]).map(t=>`<span class="tag">#${t}</span>`).join('');
    
    const isLiked = appState.likedBookIds.includes(book.id);
    updateLikeBtnStyle(likeBtn, isLiked);
    likeBtn.onclick = () => toggleLike(book.id, likeBtn);
    
    const formContainer = document.getElementById('review-form-container');
    const loginMsg = document.getElementById('login-to-review-msg');
    const submitBtn = document.getElementById('submit-review-btn');
    
    if (appState.user) {
        formContainer.classList.remove('hidden');
        loginMsg.classList.add('hidden');
        const newBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newBtn, submitBtn);
        newBtn.addEventListener('click', () => submitReview(book.id));
    } else {
        formContainer.classList.add('hidden');
        loginMsg.classList.remove('hidden');
    }
    
    fetchReviews(book.id);
    modal.classList.add('show');
}

closeModalBtn.addEventListener('click', () => modal.classList.remove('show'));
modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });

// 其他功能
loginBtn.addEventListener('click', () => signInWithPopup(auth, provider));
logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.reload()));

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        appState.filter = (e.target.id === 'show-favorites-btn') ? 'favorites' : e.target.dataset.category;
        renderBooks();
    });
});

async function loadUserLikes() {
    if (!appState.user) return;
    const userRef = doc(db, "users", appState.user.uid);
    try {
        const snap = await getDoc(userRef);
        if (snap.exists()) appState.likedBookIds = snap.data().likedBooks || [];
    } catch(e) {}
}

async function toggleLike(bookId, btn) {
    if (!appState.user) return alert("請先登入！");
    const isLiked = appState.likedBookIds.includes(bookId);
    if (isLiked) appState.likedBookIds = appState.likedBookIds.filter(id => id !== bookId);
    else appState.likedBookIds.push(bookId);
    updateLikeBtnStyle(btn, !isLiked);
    const userRef = doc(db, "users", appState.user.uid);
    await updateDoc(userRef, { likedBooks: isLiked ? arrayRemove(bookId) : arrayUnion(bookId) });
    if (appState.filter === 'favorites') renderBooks();
}

function updateLikeBtnStyle(btn, isLiked) {
    btn.classList.toggle('liked', isLiked);
    btn.innerHTML = isLiked ? (btn.classList.contains('card-like-btn') ? '❤️' : '❤️ 已收藏') : (btn.classList.contains('card-like-btn') ? '🤍' : '🤍 加入收藏');
}

// === 工具：批次匯入書籍資料 (⚠️ 已替換為真實圖片版) ===
// === 工具：批次匯入書籍資料 (修復圖片版) ===
// === 工具：批次匯入書籍資料 (針對失效圖片修復版) ===
document.getElementById('admin-upload-btn').addEventListener('click', async () => {
    if(!confirm("⚠️ 確定要修復圖片嗎？\n這將會更新所有書籍資料。")) return;
    
    try {
        console.log("正在清空舊資料...");
        const q = collection(db, "books");
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        console.log("舊資料已清空！");

        // 30 本書 (已修復《思考，快與慢》與《深度工作力》圖片)
        const booksData = [
            {
                title: "原子習慣", author: "James Clear", category: "自我成長", rating: 4.8,
                tags: ["心理學", "習慣", "生產力"],
                description: "每天進步1%，一年後你會進步37倍。細微改變帶來巨大成就的實證法則。",
                image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&q=80"
            },
            {
                title: "JavaScript 大全", author: "David Flanagan", category: "科技", rating: 4.5,
                tags: ["程式設計", "前端", "Web"],
                description: "被譽為 JavaScript 聖經，涵蓋 ES6+ 最新標準。",
                image: "https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?w=600&q=80"
            },
            {
                title: "設計的心理學", author: "Don Norman", category: "設計", rating: 4.7,
                tags: ["UX", "心理學", "產品設計"],
                description: "從日常用品到高科技產品，揭開良好設計背後的心理學原理。",
                image: "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=600&q=80"
            },
            {
                title: "Clean Code", author: "Robert C. Martin", category: "科技", rating: 4.9,
                tags: ["程式設計", "軟體工程", "品質"],
                description: "無瑕的程式碼：敏捷軟體開發技巧守則。",
                image: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=600&q=80"
            },
            {
                title: "被討厭的勇氣", author: "岸見一郎", category: "自我成長", rating: 4.6,
                tags: ["阿德勒", "心理學", "哲學"],
                description: "自我啟發之父阿德勒的哲學課，讓你有勇氣面對真實的自己。",
                image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&q=80"
            },
            {
                title: "解憂雜貨店", author: "東野圭吾", category: "文學", rating: 4.8,
                tags: ["小說", "懸疑", "溫馨"],
                description: "一間能解決煩惱的雜貨店，跨越時空的信件交流，串起溫暖人心的故事。",
                image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&q=80"
            },
            {
                title: "富爸爸，窮爸爸", author: "Robert Kiyosaki", category: "商業", rating: 4.7,
                tags: ["理財", "投資", "思維"],
                description: "打破你對金錢的既有認知，學會讓錢為你工作，而非為錢工作。",
                image: "https://images.unsplash.com/photo-1579532537598-459ecdaf39cc?w=600&q=80"
            },
            {
                title: "黑客與畫家", author: "Paul Graham", category: "科技", rating: 4.6,
                tags: ["創業", "駭客", "隨筆"],
                description: "矽谷創業教父 Paul Graham 的經典文集，探討程式設計、創業與財富的本質。",
                image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&q=80"
            },
            {
                title: "人類大歷史", author: "Yuval Noah Harari", category: "文學", rating: 4.9,
                tags: ["歷史", "人類學", "科普"],
                description: "從認知革命到科學革命，重新審視人類這個物種的過去與未來。",
                image: "https://images.unsplash.com/photo-1461360228754-6e81c478b882?w=600&q=80"
            },
            {   // 🔴 已修復圖片
                title: "深度工作力", author: "Cal Newport", category: "自我成長", rating: 4.5,
                tags: ["生產力", "專注", "職場"],
                description: "在分心的世界中，深度工作是你最稀缺也最有價值的超能力。",
                image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&q=80 "
            },
            {
                title: "Don't Make Me Think", author: "Steve Krug", category: "設計", rating: 4.6,
                tags: ["UX", "網頁設計", "易用性"],
                description: "訪客至上的網頁設計秘笈，直覺式設計的經典入門書。",
                image: "https://images.unsplash.com/photo-1509395176047-4a66953fd231?w=600&q=80"
            },
            {
                title: "演算法圖鑑", author: "石田保輝", category: "科技", rating: 4.3,
                tags: ["演算法", "圖解", "基礎"],
                description: "不需要複雜的數學，用圖片就能看懂 26 種主要的演算法與資料結構。",
                image: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=600&q=80"
            },
            {
                title: "零到一", author: "Peter Thiel", category: "商業", rating: 4.7,
                tags: ["創業", "創新", "矽谷"],
                description: "PayPal 創辦人親授，如何打造未來的獨角獸企業，創造壟斷價值。",
                image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&q=80"
            },
            {
                title: "小王子", author: "Antoine de Saint-Exupéry", category: "文學", rating: 5.0,
                tags: ["經典", "童話", "哲學"],
                description: "所有大人的必讀之書。真正重要的東西，是用眼睛看不見的。",
                image: "https://images.unsplash.com/photo-1633477189729-9290b3261d0a?w=600&q=80"
            },
            {
                title: "寫給大家看的設計書", author: "Robin Williams", category: "設計", rating: 4.5,
                tags: ["排版", "美學", "平面設計"],
                description: "掌握親密性、對齊、重複、對比四大原則，讓你的設計瞬間升級。",
                image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&q=80"
            },
            {
                title: "重構", author: "Martin Fowler", category: "科技", rating: 4.8,
                tags: ["重構", "程式設計", "架構"],
                description: "改善既有程式碼的經典指南，讓軟體更易於維護與擴充。",
                image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&q=80"
            },
            {   // 🔴 已修復圖片
                title: "思考，快與慢", author: "Daniel Kahneman", category: "自我成長", rating: 4.4,
                tags: ["心理學", "決策", "行為經濟學"],
                description: "諾貝爾獎得主解析大腦的雙系統運作，揭開人類判斷與決策的秘密。",
                image: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=600&q=80"
            },
            {
                title: "1984", author: "George Orwell", category: "文學", rating: 4.7,
                tags: ["反烏托邦", "經典", "政治"],
                description: "老大哥在看著你。極權主義下的監控與思想控制，二十世紀最駭人的預言。",
                image: "https://images.unsplash.com/photo-1535905557558-afc4877a26fc?w=600&q=80"
            },
            {
                title: "字型散步", author: "柯志杰", category: "設計", rating: 4.2,
                tags: ["字體", "觀察", "台灣"],
                description: "日常生活的字體觀察學，帶你重新發現台灣街頭文字的魅力。",
                image: "https://images.unsplash.com/photo-1560415755-bd80d06eda60?w=600&q=80"
            },
            {
                title: "影響力", author: "Robert B. Cialdini", category: "商業", rating: 4.6,
                tags: ["行銷", "心理學", "說服"],
                description: "揭開讓人點頭答應的六大心理原則，行銷人與業務必讀經典。",
                image: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&q=80"
            },
            {
                title: "軟體開發者修煉之道", author: "Dave Thomas", category: "科技", rating: 4.9,
                tags: ["職涯", "程式設計", "敏捷"],
                description: "從小工到專家，務實的程式設計師如何思考、編碼與解決問題。",
                image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&q=80"
            },
            {
                title: "百年孤寂", author: "Gabriel García Márquez", category: "文學", rating: 4.8,
                tags: ["魔幻寫實", "經典", "諾貝爾獎"],
                description: "馬康多小鎮百年的興衰，拉丁美洲魔幻寫實主義的巔峰之作。",
                image: "https://images.unsplash.com/photo-1474932430478-367dbb6832c1?w=600&q=80"
            },
            {
                title: "心流", author: "Mihaly Csikszentmihalyi", category: "自我成長", rating: 4.5,
                tags: ["心理學", "幸福", "專注"],
                description: "探索最優體驗的心理學，當你全神貫注時，將感受到極致的快樂。",
                image: "https://images.unsplash.com/photo-1517960413843-0aee8e2b3285?w=600&q=80"
            },
            {
                title: "配色設計學", author: "坂本伸二", category: "設計", rating: 4.3,
                tags: ["色彩", "美學", "工具書"],
                description: "無論是簡報、網頁還是海報，教你運用色彩傳達正確的情感。",
                image: "https://images.unsplash.com/photo-1525909002-1b05e0c869d8?w=600&q=80"
            },
            {
                title: "金字塔原理", author: "Barbara Minto", category: "商業", rating: 4.4,
                tags: ["邏輯", "寫作", "溝通"],
                description: "麥肯錫經典思考法，教你如何邏輯清晰地思考、寫作與解決問題。",
                image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&q=80"
            },
            {
                title: "Effective Java", author: "Joshua Bloch", category: "科技", rating: 4.9,
                tags: ["Java", "進階", "程式設計"],
                description: "Java 開發者的必讀聖經，包含 90 條極具價值的實戰建議。",
                image: "https://images.unsplash.com/photo-1597852074816-d933c7d2b988?w=600&q=80"
            },
            {
                title: "挪威的森林", author: "村上春樹", category: "文學", rating: 4.5,
                tags: ["愛情", "日本文學", "青春"],
                description: "每個人都有屬於自己的一片森林。村上春樹最膾炙人口的愛情經典。",
                image: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=600&q=80"
            },
            {
                title: "UX 從新手到高手", author: "廖居正", category: "設計", rating: 4.4,
                tags: ["UX", "職場", "實戰"],
                description: "台灣本土設計師的 UX 實戰經驗分享，適合轉職與入門者。",
                image: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=600&q=80"
            },
            {
                title: "原則", author: "Ray Dalio", category: "商業", rating: 4.6,
                tags: ["管理", "決策", "人生"],
                description: "橋水基金創辦人公開他的生活與工作原則，教你如何面對現實與決策。",
                image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&q=80"
            },
            {
                title: "圖解 HTTP", author: "上野宣", category: "科技", rating: 4.5,
                tags: ["網路", "HTTP", "基礎"],
                description: "工程師都該懂的網路基礎，用圖解方式輕鬆搞懂 HTTP 協定。",
                image: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600&q=80"
            }
        ];

        console.log(`開始匯入 ${booksData.length} 本新書...`);
        const addPromises = booksData.map(book => addDoc(collection(db, "books"), book));
        await Promise.all(addPromises);
        
        alert(`🎉 圖片修復完成！\n所有失效的圖片連結都已更新。\n頁面將重新整理...`);
        window.location.reload();
    } catch (e) {
        console.error("匯入失敗", e);
        alert("匯入失敗，請檢查 Console");
    }
});

init();



