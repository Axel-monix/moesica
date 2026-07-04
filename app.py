from collections import abc
import requests
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash
from flask_mysqldb import MySQL
from flask_cors import CORS
import MySQLdb.cursors

# ================= INIT =================
app = Flask(__name__)
app.config['SECRET_KEY'] = 'bebas_asal_ada_bro'
CORS(app)

# ================= DATABASE =================
app.config['MYSQL_HOST'] = '127.0.0.1'
app.config['MYSQL_USER'] = 'root'
app.config['MYSQL_PASSWORD'] = ''
app.config['MYSQL_PORT'] = 3306
app.config['MYSQL_DB'] = 'moesica'

mysql = MySQL(app)

# ================= BASE API =================
BASE_API = "http://43.106.115.184:6161/api"


# ================= HELPER =================
def safe_get_json(url, params=None):
    try:
        res = requests.get(url, params=params, timeout=10)

        print("STATUS:", res.status_code)
        print("URL:", res.url)
        print("TEXT:", res.text[:300])

        if res.status_code != 200:
            return None

        return res.json()

    except Exception as e:
        print("REQUEST ERROR:", e)
        return None


# ================= AUTH =================
@app.route('/')
def index():
    if 'loggedin' in session:
        cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
        cursor.execute('SELECT email FROM users WHERE id = %s', (session['user_id'],))
        user = cursor.fetchone()
        email = user['email'] if user else ''
        return render_template('index.html', username=session['username'], email=email)
    return redirect(url_for('login'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
        cursor.execute(
            'SELECT * FROM users WHERE username = %s AND password = %s',
            (username, password)
        )
        account = cursor.fetchone()

        if account:
            session['loggedin'] = True
            session['user_id'] = account[ 'id']
            session['username'] = account['username']
            session['password'] = account['password']
            flash('success_login')
            return redirect(url_for('index'))
        else:
            flash('error_login')

    return render_template('auth.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']

        cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)

        cursor.execute(
            'SELECT * FROM users WHERE username = %s OR email = %s',
            (username, email)
        )
        account = cursor.fetchone()

        if account:
            flash('error_register')
        else:
            cursor.execute(
                'INSERT INTO users (username, email, password) VALUES (%s, %s, %s)',
                (username, email, password)
            )
            mysql.connection.commit()
            flash('success_register')

    return render_template('register.html')


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


# ================= PLAYLIST =================
@app.route("/api/user_playlists")
def get_user_playlists():
    if 'user_id' not in session:
        return jsonify([])

    try:
        cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
        # Menggunakan user_id sesuai standard database relational
        cursor.execute('SELECT * FROM playlists WHERE user_id = %s', (session['user_id'],))
        playlists = cursor.fetchall()
        return jsonify(playlists)
    except Exception as e:
        print("PLAYLIST ERROR:", e)
        return jsonify([])

# 2. Membuat playlist baru
@app.route("/api/playlist/create", methods=['POST'])
def create_playlist():
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
    
    data = request.get_json()
    playlist_name = data.get('name')
    
    if not playlist_name:
        return jsonify({'status': 'error', 'message': 'Nama playlist tidak boleh kosong'}), 400

    cursor = mysql.connection.cursor()
    cursor.execute('INSERT INTO playlists (user_id, name) VALUES (%s, %s)', (session['user_id'], playlist_name))
    mysql.connection.commit()
    return jsonify({'status': 'success', 'message': 'Playlist berhasil dibuat!'})

# 3. Menambahkan lagu ke dalam playlist
@app.route("/api/playlist/add_song", methods=['POST'])
def add_song_to_playlist():
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401

    data = request.get_json()
    playlist_id = data.get('playlist_id')
    video_id = data.get('video_id')
    title = data.get('title')
    thumbnail = data.get('thumbnail')
    artist = data.get('artist')

    cursor = mysql.connection.cursor()
    cursor.execute('''
        INSERT INTO playlist_songs (playlist_id, video_id, title, thumbnail_url, artist) 
        VALUES (%s, %s, %s, %s, %s)
    ''', (playlist_id, video_id, title, thumbnail, artist))
    mysql.connection.commit()
    return jsonify({'status': 'success', 'message': 'Lagu ditambahkan ke playlist!'})

# 4. Fitur Toggle Like (Jika sudah like akan unlike, jika belum akan like)
@app.route("/api/like", methods=['POST'])
def toggle_like():
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401

    data = request.get_json()
    video_id = data.get('video_id')
    title = data.get('title')
    thumbnail = data.get('thumbnail')
    artist = data.get('artist')
    user_id = session['user_id']

    cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
    cursor.execute('SELECT * FROM likes WHERE user_id = %s AND video_id = %s', (user_id, video_id))
    already_liked = cursor.fetchone()

    if already_liked:
        cursor.execute('DELETE FROM likes WHERE user_id = %s AND video_id = %s', (user_id, video_id))
        mysql.connection.commit()
        return jsonify({'status': 'success', 'action': 'unliked'})
    else:
        cursor.execute('''
            INSERT INTO likes (user_id, video_id, title, thumbnail_url, artist) 
            VALUES (%s, %s, %s, %s, %s)
        ''', (user_id, video_id, title, thumbnail, artist))
        mysql.connection.commit()
        return jsonify({'status': 'success', 'action': 'liked'})

# 5. Fitur Toggle Favorite
@app.route("/api/favorite", methods=['POST'])
def toggle_favorite():
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401

    data = request.get_json()
    video_id = data.get('video_id')
    title = data.get('title')
    thumbnail = data.get('thumbnail')
    artist = data.get('artist')
    user_id = session['user_id']

    cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
    cursor.execute('SELECT * FROM favorites WHERE user_id = %s AND video_id = %s', (user_id, video_id))
    already_fav = cursor.fetchone()

    if already_fav:
        cursor.execute('DELETE FROM favorites WHERE user_id = %s AND video_id = %s', (user_id, video_id))
        mysql.connection.commit()
        return jsonify({'status': 'success', 'action': 'unfavorited'})
    else:
        cursor.execute('''
            INSERT INTO favorites (user_id, video_id, title, thumbnail_url, artist) 
            VALUES (%s, %s, %s, %s, %s)
        ''', (user_id, video_id, title, thumbnail, artist))
        mysql.connection.commit()
        return jsonify({'status': 'success', 'action': 'favorited'})


# 6. Mengambil daftar lagu yang disukai
@app.route("/api/liked_songs")
def get_liked_songs():
    if 'user_id' not in session:
        return jsonify([])
    try:
        cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
        cursor.execute('SELECT *, thumbnail_url AS thumbnail FROM likes WHERE user_id = %s ORDER BY created_at DESC', (session['user_id'],))
        songs = cursor.fetchall()
        return jsonify(songs)
    except Exception as e:
        print("LIKED SONGS ERROR:", e)
        return jsonify([])


# 7. Mengambil daftar lagu favorit
@app.route("/api/favorite_songs")
def get_favorite_songs():
    if 'user_id' not in session:
        return jsonify([])
    try:
        cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
        cursor.execute('SELECT *, thumbnail_url AS thumbnail FROM favorites WHERE user_id = %s ORDER BY created_at DESC', (session['user_id'],))
        songs = cursor.fetchall()
        return jsonify(songs)
    except Exception as e:
        print("FAVORITE SONGS ERROR:", e)
        return jsonify([])


# 8. Mengambil daftar lagu di dalam playlist tertentu
@app.route("/api/playlist/<int:playlist_id>/songs")
def get_playlist_songs(playlist_id):
    if 'user_id' not in session:
        return jsonify([])
    try:
        cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
        # Pastikan playlist milik user tersebut
        cursor.execute('SELECT id FROM playlists WHERE id = %s AND user_id = %s', (playlist_id, session['user_id']))
        playlist = cursor.fetchone()
        if not playlist:
            return jsonify([])
        
        cursor.execute('SELECT *, thumbnail_url AS thumbnail FROM playlist_songs WHERE playlist_id = %s ORDER BY added_at ASC', (playlist_id,))
        songs = cursor.fetchall()
        return jsonify(songs)
    except Exception as e:
        print("PLAYLIST SONGS ERROR:", e)
        return jsonify([])


# 9. Menghapus lagu dari playlist
@app.route("/api/playlist/remove_song", methods=['POST'])
def remove_song_from_playlist():
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
    
    data = request.get_json()
    playlist_id = data.get('playlist_id')
    video_id = data.get('video_id')
    
    if not playlist_id or not video_id:
        return jsonify({'status': 'error', 'message': 'Data tidak lengkap'}), 400
        
    try:
        cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
        # Pastikan playlist milik user tersebut
        cursor.execute('SELECT id FROM playlists WHERE id = %s AND user_id = %s', (playlist_id, session['user_id']))
        playlist = cursor.fetchone()
        if not playlist:
            return jsonify({'status': 'error', 'message': 'Playlist tidak ditemukan atau unauthorized'}), 404
            
        cursor.execute('DELETE FROM playlist_songs WHERE playlist_id = %s AND video_id = %s', (playlist_id, video_id))
        mysql.connection.commit()
        return jsonify({'status': 'success', 'message': 'Lagu berhasil dihapus dari playlist'})
    except Exception as e:
        print("REMOVE SONG ERROR:", e)
        return jsonify({'status': 'error', 'message': 'Gagal menghapus lagu'}), 500


# 10. Menghapus playlist
@app.route("/api/playlist/delete/<int:playlist_id>", methods=['DELETE'])
def delete_playlist(playlist_id):
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
        
    try:
        cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
        # Pastikan playlist milik user tersebut
        cursor.execute('SELECT id FROM playlists WHERE id = %s AND user_id = %s', (playlist_id, session['user_id']))
        playlist = cursor.fetchone()
        if not playlist:
            return jsonify({'status': 'error', 'message': 'Playlist tidak ditemukan atau unauthorized'}), 404
            
        # Hapus lagu di dalam playlist
        cursor.execute('DELETE FROM playlist_songs WHERE playlist_id = %s', (playlist_id,))
        # Hapus playlist itu sendiri
        cursor.execute('DELETE FROM playlists WHERE id = %s', (playlist_id,))
        mysql.connection.commit()
        return jsonify({'status': 'success', 'message': 'Playlist berhasil dihapus'})
    except Exception as e:
        print("DELETE PLAYLIST ERROR:", e)
        return jsonify({'status': 'error', 'message': 'Gagal menghapus playlist'}), 500


# 11. Cek status lagu
@app.route("/api/track_status/<video_id>")
def track_status(video_id):
    if 'user_id' not in session:
        return jsonify({"liked": False, "favorited": False, "in_playlist": False})
        
    user_id = session['user_id']
    cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
    
    # Check like
    cursor.execute('SELECT 1 FROM likes WHERE user_id = %s AND video_id = %s', (user_id, video_id))
    liked = cursor.fetchone() is not None
    
    # Check favorite
    cursor.execute('SELECT 1 FROM favorites WHERE user_id = %s AND video_id = %s', (user_id, video_id))
    favorited = cursor.fetchone() is not None
    
    # Check playlist
    cursor.execute('''
        SELECT 1 FROM playlist_songs ps 
        JOIN playlists p ON ps.playlist_id = p.id 
        WHERE p.user_id = %s AND ps.video_id = %s
    ''', (user_id, video_id))
    in_playlist = cursor.fetchone() is not None
    
    return jsonify({"liked": liked, "favorited": favorited, "in_playlist": in_playlist})


# ================= SEARCH =================
@app.route("/search")
def search():
    query = request.args.get("q")

    if not query:
        return jsonify([])

    data = safe_get_json(
        f"{BASE_API}/search",
        {"q": query, "filter": "song", "limit": 10}
    )

    if not data:
        return jsonify([])

    results = []

    for item in data.get("data", []):
        video_id = (
            item.get("videoId") or
            item.get("id") or
            item.get("video_id")
        )

        if not video_id and item.get("url"):
            url = item.get("url")
            if "v=" in url:
                video_id = url.split("v=")[-1]

        results.append({
            "title": item.get("title", "Unknown Title"),
            "thumbnail": item.get("thumbnail"),
            "video_id": video_id
        })

    return jsonify(results)


# ================= TRENDING =================
@app.route("/trending")
def trending():
    data = safe_get_json(
        f"{BASE_API}/trending",
        {"country": "ID", "limit": 30}
    )

    if not data:
        return jsonify([])

    # 🔥 FIX PARSING
    if isinstance(data, dict):
        raw_items = data.get("data", [])
    elif isinstance(data, list):
        raw_items = data
    else:
        raw_items = []

    results = []

    for item in raw_items:
        results.append({
            "title": item.get("title", "Unknown Title"),
            "thumbnail": item.get("thumbnail"),
            "video_id": item.get("id") 
        })

    print("TRENDING RESULT:", len(results))

    return jsonify(results)
# ================= STREAM =================
@app.route("/stream/<video_id>")
def stream(video_id):
    data = safe_get_json(
        f"{BASE_API}/stream/{video_id}",
        {"mode": "audio"}
    )

    if not data:
        return jsonify({"error": "stream failed"}), 500

    return jsonify(data)


# ================= RECOMMENDATIONS =================
@app.route("/recommendations/<video_id>")
def recommendations(video_id):
    data = safe_get_json(
        f"{BASE_API}/recommendations/{video_id}",
        {"limit": 10}
    )

    if not data:
        return jsonify([])

    return jsonify(data)


# ================= RUN =================
if __name__ == "__main__":
    app.run(debug=True)