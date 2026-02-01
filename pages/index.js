import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

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
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username }),
            });

            if (res.ok) {
                const data = await res.json();
                localStorage.setItem('chat_user', JSON.stringify(data.user));
                router.push('/chat');
            } else {
                alert('Login failed');
            }
        } catch (error) {
            console.error(error);
            alert('An error occurred');
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
