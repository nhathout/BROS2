FROM ros:humble
SHELL ["/bin/bash","-lc"]

RUN apt-get update && apt-get install -y \
    python3-colcon-common-extensions python3-rosdep \
    ros-humble-rosbridge-server \
    ros-humble-turtlesim \
    ros-humble-rqt-graph \
    graphviz \
  && rm -rf /var/lib/apt/lists/*

# dev user (optional)
RUN useradd -ms /bin/bash dev && adduser dev sudo && echo "dev ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
USER dev
WORKDIR /home/dev

RUN sudo rosdep init || true && rosdep update || true
RUN mkdir -p /home/dev/ws/src
ENV RMW_IMPLEMENTATION=rmw_fastrtps_cpp
