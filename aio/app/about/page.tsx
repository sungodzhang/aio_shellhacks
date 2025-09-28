const AboutMe: React.FC = () => {
  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      minHeight: "100vh", 
      padding: "2rem",
      fontFamily: "Arial, sans-serif",
      lineHeight: 1.8
    }}>
      <h1 
        style={{ 
          textAlign: "center", 
          marginBottom: "2rem", 
          fontSize: "3rem", 
          fontWeight: "bold" 
        }}
      >
        Hello Learners!
      </h1>

      <div style={{ maxWidth: "550px", textAlign: "left" }}>
        <p style={{ marginBottom: "1.5rem" }}>
          Learning today is harder than ever. Traditional methods like lectures or 
          reading from a textbook often feel boring and dull. Many students struggle 
          to stay engaged with the material, and those with conditions such as ADHD 
          can find themselves at an even greater disadvantage.
        </p>

        <p style={{ marginBottom: "1.5rem" }}>
          On the other hand, modern tools like ChatGPT can be useful, but they usually 
          provide the answer without engaging the student. This leaves little room 
          for curiosity, discovery, or the kind of challenge that makes learning stick.
        </p>

        <p style={{ marginBottom: "1.5rem" }}>
          That's why we created this app. To use AI not just to give solutions, 
          but to build interactive representations of topics. 
          Our goal is to challenge students while making the process <strong>fun, 
          engaging, and personable.</strong> 
        </p>

        <p>
          With this technology, we hope students everywhere can grow, 
          learn more effectively, and rediscover the joy of learning.
        </p>
      </div>

      <div style={{ marginTop: "3rem", textAlign: "center" }}>
        <img 
          src="/logo.png"
          alt="App Logo" 
          style={{ width: "80px", height: "auto" }} 
        />
      </div>
    </div>
  );
};

export default AboutMe;
