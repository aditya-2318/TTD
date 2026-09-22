// =====================================================
// SUPABASE CONFIGURATION
// =====================================================

// Replace these with your own Supabase values.

const SUPABASE_URL = "https://ltrydfyqapfigudpyuqb.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_vsgbQH0Zos3HLGZ7NKDPnA_GysCTtAu";


const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


// =====================================================
// GLOBAL VARIABLES
// =====================================================

let currentUser = null;
let currentProfile = null;

let employees = [];
let selectedEmployee = null;


// =====================================================
// PAGE ELEMENTS
// =====================================================

const loginPage = document.getElementById("loginPage");
const appPage = document.getElementById("appPage");

const employeeSection = document.getElementById("employeeSection");
const ownerSection = document.getElementById("ownerSection");

const employeeTasks = document.getElementById("employeeTasks");
const ownerTasks = document.getElementById("ownerTasks");

const userName = document.getElementById("userName");
const userRole = document.getElementById("userRole");


// =====================================================
// INITIALISE APP
// =====================================================

async function init() {

    const {
        data: {
            session
        }
    } = await supabaseClient.auth.getSession();


    if (session) {

        currentUser = session.user;

        await loadUserProfile();

    } else {

        showLogin();

    }
}


init();


// =====================================================
// AUTH STATE
// =====================================================

supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

        if (session) {

            currentUser = session.user;

            await loadUserProfile();

        } else {

            currentUser = null;

            currentProfile = null;

            showLogin();

        }

    }
);


// =====================================================
// LOGIN
// =====================================================

document
    .getElementById("loginForm")
    .addEventListener("submit", async (event) => {

        event.preventDefault();


        const email =
            document.getElementById("email").value.trim();

        const password =
            document.getElementById("password").value;


        const errorElement =
            document.getElementById("loginError");


        errorElement.textContent = "";


        const {
            data,
            error
        } = await supabaseClient.auth.signInWithPassword({

            email: email,

            password: password

        });


        if (error) {

            errorElement.textContent =
                "Invalid email or password.";

            return;

        }


        currentUser = data.user;

    });


// =====================================================
// LOAD USER PROFILE
// =====================================================

async function loadUserProfile() {

    const {
        data,
        error
    } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();


    if (error) {

        console.error(error);

        alert(
            "Your account exists but no profile has been created."
        );

        await supabaseClient.auth.signOut();

        return;

    }


    currentProfile = data;


    userName.textContent =
        currentProfile.full_name;

    userRole.textContent =
        currentProfile.role.toUpperCase();


    loginPage.classList.add("hidden");

    appPage.classList.remove("hidden");


    if (currentProfile.role === "owner") {

        employeeSection.classList.add("hidden");

        ownerSection.classList.remove("hidden");

        await loadEmployees();

    } else {

        employeeSection.classList.remove("hidden");

        ownerSection.classList.add("hidden");

        await loadMyTasks();

    }

}


// =====================================================
// SHOW LOGIN
// =====================================================

function showLogin() {

    loginPage.classList.remove("hidden");

    appPage.classList.add("hidden");

}


// =====================================================
// LOGOUT
// =====================================================

document
    .getElementById("logoutButton")
    .addEventListener("click", async () => {

        await supabaseClient.auth.signOut();

    });


// =====================================================
// LOAD EMPLOYEE TASKS
// =====================================================

async function loadMyTasks() {

    const {
        data,
        error
    } = await supabaseClient
        .from("tasks")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("task_date", {
            ascending: true
        });


    if (error) {

        console.error(error);

        return;

    }


    renderTasks(
        data,
        employeeTasks
    );

}


// =====================================================
// RENDER TASKS
// =====================================================

function renderTasks(tasks, container) {

    container.innerHTML = "";


    if (!tasks || tasks.length === 0) {

        container.innerHTML = `
            <div class="task-day">
                <div class="task-list">
                    <p style="padding:20px;color:#777;">
                        No tasks found.
                    </p>
                </div>
            </div>
        `;

        return;

    }


    // Group tasks by date

    const grouped = {};


    tasks.forEach(task => {

        if (!grouped[task.task_date]) {

            grouped[task.task_date] = [];

        }

        grouped[task.task_date].push(task);

    });


    Object.keys(grouped)
        .sort()
        .forEach(date => {


            const dayTasks =
                grouped[date];


            // Pending first
            // Completed afterwards

            dayTasks.sort(
                (a, b) =>
                    Number(a.completed) -
                    Number(b.completed)
            );


            const dayElement =
                document.createElement("div");


            dayElement.className =
                "task-day";


            dayElement.innerHTML = `

                <div class="task-date">
                    ${formatDate(date)}
                </div>

                <div class="task-list"></div>

            `;


            const taskList =
                dayElement.querySelector(
                    ".task-list"
                );


            dayTasks.forEach(task => {

                const taskElement =
                    document.createElement("div");


                taskElement.className =
                    "task" +
                    (task.completed
                        ? " completed"
                        : "");


                taskElement.innerHTML = `

                    <input
                        type="checkbox"
                        class="task-checkbox"
                        ${task.completed ? "checked" : ""}
                    >

                    <span class="task-title">
                        ${escapeHTML(task.title)}
                    </span>

                `;


                const checkbox =
                    taskElement.querySelector(
                        ".task-checkbox"
                    );


                checkbox.addEventListener(
                    "change",
                    () => toggleTask(
                        task.id,
                        checkbox.checked
                    )
                );


                taskList.appendChild(
                    taskElement
                );

            });


            container.appendChild(
                dayElement
            );

        });

}


// =====================================================
// TOGGLE TASK
// =====================================================

async function toggleTask(
    taskId,
    completed
) {

    const {
        error
    } = await supabaseClient
        .from("tasks")
        .update({

            completed: completed,

            completed_at:
                completed
                    ? new Date().toISOString()
                    : null

        })
        .eq("id", taskId);


    if (error) {

        console.error(error);

        alert(
            "Unable to update task."
        );

        return;

    }


    if (
        currentProfile.role ===
        "owner"
    ) {

        await loadSelectedEmployeeTasks();

    } else {

        await loadMyTasks();

    }

}


// =====================================================
// ADD EMPLOYEE TASK
// =====================================================

document
    .getElementById("taskForm")
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const title =
                document
                    .getElementById("taskTitle")
                    .value
                    .trim();


            const date =
                document
                    .getElementById("taskDate")
                    .value;


            if (!title || !date) {

                return;

            }


            const {
                error
            } = await supabaseClient
                .from("tasks")
                .insert({

                    user_id:
                        currentUser.id,

                    title: title,

                    task_date: date,

                    created_by:
                        currentUser.id

                });


            if (error) {

                console.error(error);

                alert(
                    "Unable to add task."
                );

                return;

            }


            closeTaskModal();


            document
                .getElementById("taskForm")
                .reset();


            await loadMyTasks();

        }
    );


// =====================================================
// MODAL
// =====================================================

function openTaskModal() {

    document
        .getElementById("taskModal")
        .classList
        .remove("hidden");


    document
        .getElementById("taskDate")
        .value =
        getToday();

}


function closeTaskModal() {

    document
        .getElementById("taskModal")
        .classList
        .add("hidden");

}


// =====================================================
// OWNER: LOAD EMPLOYEES
// =====================================================

async function loadEmployees() {

    const {
        data,
        error
    } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("role", "employee")
        .order("full_name");


    if (error) {

        console.error(error);

        return;

    }


    employees = data || [];

    renderEmployees(employees);

}


// =====================================================
// OWNER: RENDER EMPLOYEES
// =====================================================

function renderEmployees(list) {

    const container =
        document.getElementById(
            "employees"
        );


    container.innerHTML = "";


    list.forEach(employee => {

        const element =
            document.createElement("div");


        element.className =
            "employee-item";


        if (
            selectedEmployee &&
            selectedEmployee.id === employee.id
        ) {

            element.classList.add(
                "active"
            );

        }


        element.innerHTML = `

            <div class="employee-name">
                ${escapeHTML(employee.full_name)}
            </div>

            <div class="employee-role">
                Employee
            </div>

        `;


        element.addEventListener(
            "click",
            () => selectEmployee(employee)
        );


        container.appendChild(
            element
        );

    });

}


// =====================================================
// OWNER: SEARCH
// =====================================================

document
    .getElementById("employeeSearch")
    .addEventListener(
        "input",
        event => {

            const search =
                event.target.value
                    .toLowerCase()
                    .trim();


            const filtered =
                employees.filter(
                    employee =>
                        employee
                            .full_name
                            .toLowerCase()
                            .includes(search)
                );


            renderEmployees(
                filtered
            );

        }
    );


// =====================================================
// OWNER: SELECT EMPLOYEE
// =====================================================

async function selectEmployee(
    employee
) {

    selectedEmployee =
        employee;


    renderEmployees(
        employees
    );


    document
        .getElementById(
            "selectedEmployeeHeader"
        )
        .innerHTML = `

            <h2>
                ${escapeHTML(employee.full_name)}
            </h2>

            <p>
                Employee task list
            </p>

        `;


    document
        .getElementById(
            "ownerAddTaskButton"
        )
        .classList
        .remove("hidden");


    await loadSelectedEmployeeTasks();

}


// =====================================================
// OWNER: LOAD SELECTED EMPLOYEE TASKS
// =====================================================

async function loadSelectedEmployeeTasks() {

    if (!selectedEmployee) {

        return;

    }


    const {
        data,
        error
    } = await supabaseClient
        .from("tasks")
        .select("*")
        .eq(
            "user_id",
            selectedEmployee.id
        )
        .order("task_date", {
            ascending: true
        });


    if (error) {

        console.error(error);

        return;

    }


    renderTasks(
        data,
        ownerTasks
    );

}


// =====================================================
// OWNER: ADD TASK
// =====================================================

document
    .getElementById("ownerTaskForm")
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            if (!selectedEmployee) {

                return;

            }


            const title =
                document
                    .getElementById(
                        "ownerTaskTitle"
                    )
                    .value
                    .trim();


            const date =
                document
                    .getElementById(
                        "ownerTaskDate"
                    )
                    .value;


            const {
                error
            } = await supabaseClient
                .from("tasks")
                .insert({

                    user_id:
                        selectedEmployee.id,

                    title: title,

                    task_date: date,

                    created_by:
                        currentUser.id

                });


            if (error) {

                console.error(error);

                alert(
                    "Unable to add task."
                );

                return;

            }


            closeOwnerTaskModal();


            document
                .getElementById(
                    "ownerTaskForm"
                )
                .reset();


            await loadSelectedEmployeeTasks();

        }
    );


// =====================================================
// OWNER MODAL
// =====================================================

function openOwnerTaskModal() {

    if (!selectedEmployee) {

        return;

    }


    document
        .getElementById(
            "ownerTaskModal"
        )
        .classList
        .remove("hidden");


    document
        .getElementById(
            "ownerTaskDate"
        )
        .value =
        getToday();

}


function closeOwnerTaskModal() {

    document
        .getElementById(
            "ownerTaskModal"
        )
        .classList
        .add("hidden");

}


// =====================================================
// DATE FORMAT
// =====================================================

function formatDate(dateString) {

    const date =
        new Date(
            dateString + "T00:00:00"
        );


    return date.toLocaleDateString(
        "en-GB",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

}


// =====================================================
// TODAY
// =====================================================

function getToday() {

    const date =
        new Date();


    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");


    const day =
        String(
            date.getDate()
        ).padStart(2, "0");


    return `${year}-${month}-${day}`;

}


// =====================================================
// SECURITY: ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}