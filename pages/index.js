import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db } from '../utils/firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';

export default function Home() {
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const user = localStorage.getItem('chat_user');
        if (user) {
            router.push('/chat');
        }
    }, [router]);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!username.trim()) return;

        setLoading(true);
        try {
            if (!db) {
                throw new Error("Firebase is not initialized. Please check your Environment Variables in Netlify (NEXT_PUBLIC_FIREBASE_API_KEY, etc).");
            }
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('username', '==', username));
            const querySnapshot = await getDocs(q);

            let userData;

            if (!querySnapshot.empty) {
                // consistent with previous logic: simple "login" by username
                const doc = querySnapshot.docs[0];
                userData = { id: doc.id, ...doc.data() };
            } else {
                // Create new user
                const docRef = await addDoc(usersRef, { username });
                userData = { id: docRef.id, username };
            }

            localStorage.setItem('chat_user', JSON.stringify(userData));
            router.push('/chat');
        } catch (error) {
            console.error("Login error:", error);
            alert('Login failed. Check console.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-box fade-in">
                <h1 className="auth-title">AntiGravity Chat</h1>
                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="Enter your username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={loading}
                            autoFocus
                        />
                    </div>
                    <button type="submit" className="btn" disabled={loading}>
                        {loading ? 'Entering...' : 'Enter Chat'}
                    </button>
                </form>
            </div>
        </div>
    );
}
