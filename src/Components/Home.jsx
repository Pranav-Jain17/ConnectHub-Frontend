import './home.css';

function Home() {
    return (
        <div className="home-page">
            <div className="home-container">
                <div className="home-left">
                    <h1>Welcome to ConnectHub</h1>
                    <p>
                        Connect instantly with your team or friends.
                        <br />
                        Start or join a meeting with one click.
                    </p>
                    <div className="home-buttons">
                        <button className="btn-join">Join Meet</button>
                        <button className="btn-create">Create Meet</button>
                    </div>
                </div>
                <div className="home-right">
                    <img src="/assets/signup.png" alt="Meeting illustration" />
                </div>
            </div>
        </div>
    );
}

export default Home;
