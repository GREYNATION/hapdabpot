document.addEventListener('DOMContentLoaded', () => {
    
    /* --- GSAP Initialization --- */
    gsap.registerPlugin(ScrollTrigger);

    /* --- Custom Cursor Logic --- */
    const cursorDot = document.getElementById('cursor-dot');
    const cursorOutline = document.getElementById('cursor-outline');

    window.addEventListener('mousemove', (e) => {
        const posX = e.clientX;
        const posY = e.clientY;

        gsap.to(cursorDot, { x: posX, y: posY, duration: 0.1 });
        gsap.to(cursorOutline, { x: posX, y: posY, duration: 0.5, ease: "power2.out" });
    });

    const links = document.querySelectorAll('a, button, .card, .modal-close');
    links.forEach(link => {
        link.addEventListener('mouseenter', () => {
            gsap.to(cursorOutline, { scale: 1.5, borderColor: '#D4FF47', backgroundColor: 'rgba(212, 255, 71, 0.1)', duration: 0.3 });
            gsap.to(cursorDot, { scale: 0.5, duration: 0.3 });
        });
        link.addEventListener('mouseleave', () => {
            gsap.to(cursorOutline, { scale: 1, borderColor: 'rgba(255, 255, 255, 0.15)', backgroundColor: 'transparent', duration: 0.3 });
            gsap.to(cursorDot, { scale: 1, duration: 0.3 });
        });
    });

    /* --- Modal Logic --- */
    const modal = document.getElementById('bookingModal');
    const closeModalBtn = document.getElementById('closeModal');
    const bookingForm = document.getElementById('bookingForm');
    const formSuccess = document.getElementById('formSuccess');
    const closeSuccessBtn = document.getElementById('closeSuccess');
    
    // Service Selection Logic
    const serviceTiles = document.querySelectorAll('.service-tile');
    const serviceInput = document.getElementById('service_interest');

    serviceTiles.forEach(tile => {
        tile.addEventListener('click', () => {
            // Toggle active state
            serviceTiles.forEach(t => t.classList.remove('active'));
            tile.classList.add('active');
            
            // Update hidden input
            serviceInput.value = tile.getAttribute('data-value');
        });
    });

    const openModal = () => {
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
        
        // CRITICAL FIX: Reset form visibility and position
        gsap.set(bookingForm, { opacity: 1, y: 0, display: 'flex' });
        formSuccess.classList.remove('show');
    };

    const closeModal = () => {
        modal.classList.remove('open');
        document.body.style.overflow = '';
        
        // Reset form state after exit
        setTimeout(() => {
            bookingForm.reset();
            serviceTiles.forEach(t => t.classList.remove('active'));
            serviceInput.value = '';
        }, 400);
    };

    window.openModal = openModal; 

    closeModalBtn.addEventListener('click', closeModal);
    closeSuccessBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    /* --- Form Submission (handlesubmit logic sync) --- */
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fname = document.getElementById('fname').value.trim();
        const lname = document.getElementById('lname').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const btype = document.getElementById('btype').value;
        const service = serviceInput.value;
        const notes = document.getElementById('notes').value.trim();

        if (!fname || !email || !btype) {
            alert('Please fill in your name, email, and business type.');
            return;
        }

        const btn = document.getElementById('submitForm');
        const originalBtnText = btn.innerText;
        btn.textContent = 'Sending...';
        btn.disabled = true;

        try {
            // Updated to absolute URL as per snippet requirement
            const res = await fetch('https://www.stuyza.com/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fname, lname, email, phone, biz_type: btype, service, notes })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Submission failed');

            // Premium transition to success state
            gsap.to(bookingForm, {
                opacity: 0,
                y: -20,
                duration: 0.4,
                onComplete: () => {
                    bookingForm.style.display = 'none';
                    formSuccess.classList.add('show');
                    gsap.fromTo(formSuccess, 
                        { opacity: 0, y: 20 },
                        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }
                    );
                }
            });

        } catch (err) {
            console.error('Submission error:', err);
            alert('Something went wrong. Email us at hello@stuyza.com');
            btn.textContent = originalBtnText;
            btn.disabled = false;
        }
    });

    /* --- Entrance Animations --- */
    const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

    tl.from(".nav-links li, .nav-cta, .logo", { y: -50, opacity: 0, stagger: 0.05, duration: 1 })
      .from(".hero-badge", { y: 20, opacity: 0, duration: 0.8 }, "-=0.5")
      .from(".hero h1", { y: 100, opacity: 0, duration: 1.2 }, "-=0.8")
      .from(".hero p", { y: 30, opacity: 0, duration: 1 }, "-=1")
      .from(".hero-actions", { y: 20, opacity: 0, duration: 1 }, "-=0.8");

    /* --- Scroll Reveal Animations --- */
    const reveals = document.querySelectorAll('.reveal');
    reveals.forEach((el) => {
        gsap.from(el, {
            scrollTrigger: {
                trigger: el,
                start: "top 85%",
                toggleActions: "play none none none"
            },
            y: 50,
            opacity: 0,
            duration: 1,
            ease: "power3.out"
        });
    });

    /* --- Card Hover 3D Tilt --- */
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;

            gsap.to(card, { rotateX: rotateX, rotateY: rotateY, duration: 0.5, ease: "power2.out" });
        });
        card.addEventListener('mouseleave', () => {
            gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.5, ease: "power2.out" });
        });
    });

    /* --- Stats Counter Animation --- */
    const stats = document.querySelectorAll('.stat-num');
    stats.forEach(stat => {
        const textVal = stat.innerText;
        const target = parseFloat(textVal.replace(/[^0-9.]/g, ''));
        const suffix = textVal.replace(/[0-9.]/g, '');
        const prefix = textVal.startsWith('$') ? '$' : '';
        
        ScrollTrigger.create({
            trigger: stat,
            start: "top 90%",
            onEnter: () => {
                let current = { val: 0 };
                gsap.to(current, {
                    val: target,
                    duration: 2,
                    ease: "power2.out",
                    onUpdate: () => {
                        stat.innerText = prefix + (target % 1 === 0 ? Math.floor(current.val) : current.val.toFixed(1)) + suffix;
                    }
                });
            }
        });
    });

    /* --- Smooth Internal Links --- */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                gsap.to(window, {
                    scrollTo: target.offsetTop - 80,
                    duration: 1.5,
                    ease: "power4.inOut"
                });
            }
        });
    });

});
